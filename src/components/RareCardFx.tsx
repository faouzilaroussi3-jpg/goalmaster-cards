import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { CardFire, fireSprites } from "@/components/CardFire";
import { cn } from "@/lib/utils";
import { BREATH_TOTAL_MS, BREATH_WINDUP_MS, breathIntensity, nextBreathDelay } from "@/lib/dragon-breath";
import dragonHead from "@/assets/dragon/su-dragon-head.webp";
import dragonClaw from "@/assets/dragon/su-dragon-claw.webp";
import dragonWing from "@/assets/dragon/su-dragon-wing.webp";
import dragonTail from "@/assets/dragon/su-dragon-tail.webp";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

// The card is 5:7, so a 100x140 viewBox maps 1:1 without distortion.
const ORBIT = "M12,2.5 H88 Q97.5,2.5 97.5,12 V128 Q97.5,137.5 88,137.5 H12 Q2.5,137.5 2.5,128 V12 Q2.5,2.5 12,2.5 Z";
/** Secret Ultimate frame: realistic particle fire along the card edges (the dragon wraps around the card, see SuDragonShell). */
export function SecretUltimateFx() {
  return <CardFire className="su-fire" />;
}

// Mouth opening in the head picture (fractions of its box) and the fire jet direction (radians, up and to the right).
const MOUTH = { x: 0.85, y: 0.37 };
const JET_ANGLE = -0.55;

interface Flame { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; grow: number; ember: boolean; seed: number }

function Part({ src, className, w, h }: { src: string; className: string; w: number; h: number }) {
  return <img src={src} alt="" width={w} height={h} draggable={false} loading="lazy" decoding="async" className={cn("su-part", className)} />;
}

/**
 * Secret Ultimate shell: a red dragon wrapped around the card. Wings and tail spread behind it, claws grip its
 * sides, and its head rises over the top edge, breathing a particle fire jet every few seconds (random per card)
 * that floods the card with flame light. The shell is unclipped so the limbs can stick out of the card.
 */
export function SuDragonShell({ className, missing, children }: { className?: string; missing?: boolean; children: ReactNode }) {
  const shell = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = shell.current, cv = canvas.current, hd = head.current;
    if (!el || !cv || !hd || window.matchMedia(QUERY).matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const sprites = fireSprites(cv);
    const top = sprites.length - 1;

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const parts: Flame[] = [];
    let raf = 0, last = 0, running = false, acc = 0, embers = 0, t = 0;
    let breathAt = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (ms: number) => { clearTimeout(timer); timer = setTimeout(breathe, ms); };
    const breathe = () => {
      if (!running) return;
      breathAt = performance.now();
      el.classList.add("is-breathing");
      timer = setTimeout(() => { el.classList.remove("is-breathing"); breathAt = -1; schedule(nextBreathDelay()); }, BREATH_TOTAL_MS);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      const cr = cv.getBoundingClientRect();
      const hr = hd.getBoundingClientRect();
      const sx = cr.width ? w / cr.width : 1;
      const mx = (hr.left - cr.left + hr.width * MOUTH.x) * sx;
      const my = (hr.top - cr.top + hr.height * MOUTH.y) * sx;
      const u = el.clientWidth / 100; // 1% of card width
      const ms = breathAt < 0 ? -1 : now - breathAt;
      const k = ms < 0 ? 0 : breathIntensity(ms);

      acc += dt * k * Math.max(220, el.clientWidth * 2.6);
      while (acc > 1) {
        acc -= 1;
        const a = JET_ANGLE + (Math.random() - 0.5) * 0.34;
        const sp = (80 + Math.random() * 45) * u;
        parts.push({ x: mx + (Math.random() - 0.5) * 2 * u, y: my + (Math.random() - 0.5) * 2 * u, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.45 + Math.random() * 0.3, size: (3 + Math.random() * 2) * u, grow: (13 + Math.random() * 9) * u, ember: false, seed: Math.random() * 1000 });
      }
      // A few embers always drift out of the mouth, even between breaths.
      embers += dt * (4 + k * 30);
      while (embers > 1) {
        embers -= 1;
        parts.push({ x: mx, y: my, vx: (Math.random() * 10 - 2) * u, vy: -(8 + Math.random() * 10) * u, age: 0, life: 0.8 + Math.random() * 0.7, size: (1.2 + Math.random() * 1.4) * u, grow: 0, ember: true, seed: Math.random() * 1000 });
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      // Glow inside the mouth: smoulders at rest, swells while the dragon draws breath, blazes while it breathes.
      const glow = ms < 0 ? 0.25 : ms < BREATH_WINDUP_MS ? 0.25 + 0.75 * (ms / BREATH_WINDUP_MS) : Math.max(0.25, k);
      ctx.globalAlpha = glow * 0.8;
      const g = (8 + 10 * glow) * u;
      ctx.drawImage(sprites[2]!, mx - g / 2, my - g / 2, g, g);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.age += dt;
        const q = p.age / p.life;
        if (q >= 1) { parts.splice(i, 1); continue; }
        if (p.ember) {
          p.x += (p.vx + Math.sin(p.seed + t * 5) * 4 * u) * dt;
          p.y += p.vy * dt;
          ctx.globalAlpha = (1 - q) * 0.9;
          ctx.drawImage(sprites[Math.floor(q * 0.6 * top)]!, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          continue;
        }
        const drag = 1 - Math.min(1, 1.1 * dt);
        p.vx *= drag; p.vy *= drag;
        p.vy -= 30 * u * dt; // hot gas rises and curls the plume upward
        p.x += (p.vx + Math.sin(p.seed + t * 13 + p.y * 0.05) * 14 * u * q) * dt;
        p.y += (p.vy + Math.cos(p.seed + t * 11 + p.x * 0.05) * 10 * u * q) * dt;
        const size = p.size + (p.grow - p.size) * Math.sqrt(q);
        // Each tongue is stretched along its motion; only the youngest flames near the mouth burn white-hot.
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = Math.min(2.4, 1 + speed / (55 * u));
        ctx.globalAlpha = (q < 0.06 ? q / 0.06 : (1 - q) * (1 - q)) * 0.38; // the red tail fades fast so it never piles up into pink
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.drawImage(sprites[Math.min(top, Math.floor(Math.pow(q, 0.7) * sprites.length))]!, (-size * stretch) / 2, -size / 2, size * stretch, size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true; last = performance.now(); raf = requestAnimationFrame(tick);
      schedule(600 + Math.random() * 2400);
    };
    const stop = () => {
      running = false; cancelAnimationFrame(raf); clearTimeout(timer);
      el.classList.remove("is-breathing"); breathAt = -1; parts.length = 0;
    };
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()), { rootMargin: "100px" });
    io.observe(el);
    return () => { stop(); io.disconnect(); ro.disconnect(); };
  }, []);

  return (
    <div ref={shell} className={cn("su-shell", missing && "is-missing", className)}>
      <div className="su-back" aria-hidden="true">
        <div className="su-side"><Part src={dragonWing} className="su-wing" w={600} h={600} /></div>
        <div className="su-side is-mirror"><Part src={dragonWing} className="su-wing" w={600} h={600} /></div>
        <Part src={dragonTail} className="su-tail" w={420} h={560} />
        <img ref={head} src={dragonHead} alt="" width={720} height={720} draggable={false} loading="lazy" decoding="async" className="su-part su-head" />
        <canvas ref={canvas} className="su-breath" />
      </div>
      {children}
      <div className="su-breath-glow" aria-hidden="true" />
      <div className="su-front" aria-hidden="true">
        <div className="su-side">
          <Part src={dragonClaw} className="su-claw su-claw-fore" w={480} h={480} />
          <Part src={dragonClaw} className="su-claw su-claw-hind" w={480} h={480} />
        </div>
        <div className="su-side is-mirror">
          <Part src={dragonClaw} className="su-claw su-claw-fore" w={480} h={480} />
          <Part src={dragonClaw} className="su-claw su-claw-hind" w={480} h={480} />
        </div>
      </div>
    </div>
  );
}

const DIAMOND_LAP_S = 6;
const TRAIL = [1, 2, 3, 4, 5];

// Small diamonds gravitating over the card face on three nested, tilted ellipses centred on the card
// (viewBox 100x140), alternating direction. Gems on a ring are evenly spaced so the face stays balanced;
// each one shrinks and dims on the far side of its ring to read as a 3D orbit.
type Ring = { rx: number; ry: number; tilt: number; lap: number; cw: boolean; gems: number; size: number };
const RINGS: Ring[] = [
  { rx: 41, ry: 58, tilt: 0, lap: 16, cw: true, gems: 3, size: 0.9 },
  { rx: 33, ry: 47, tilt: 24, lap: 12, cw: false, gems: 3, size: 0.75 },
  { rx: 22, ry: 34, tilt: -28, lap: 9, cw: true, gems: 2, size: 0.62 },
];
const ellipse = ({ rx, ry, cw }: Ring) => {
  const sweep = cw ? 1 : 0;
  return `M${50 - rx},70 A${rx},${ry} 0 1 ${sweep} ${50 + rx},70 A${rx},${ry} 0 1 ${sweep} ${50 - rx},70 Z`;
};

function Gem({ fill, scale }: { fill: string; scale: number }) {
  return (
    <g className="sl-gem" transform={`scale(${scale})`}>
      <polygon points="-3,-0.8 -1.8,-2.3 1.8,-2.3 3,-0.8 0,3.2" fill={fill} />
      <path className="sl-gem-facets" d="M-3,-0.8 H3 M-1.8,-2.3 L-0.9,-0.8 L0,-2.3 L0.9,-0.8 L1.8,-2.3 M-0.9,-0.8 L0,3.2 L0.9,-0.8" />
      <path className="sl-gem-star" d="M0,-5.2 L0.45,-2.9 L2.6,-2.5 L0.45,-2.1 L0,0.2 L-0.45,-2.1 L-2.6,-2.5 L-0.45,-2.9 Z" />
    </g>
  );
}

/** Secret Legendary: a brilliant-cut diamond orbiting the card edge with a sparkle trail, plus small diamonds gravitating over the face. */
export function DiamondOrbitFx() {
  const reduced = useReducedMotion();
  const orbit = useSvgId("sl-orbit");
  const gem = useSvgId("sl-gem");
  const ring = useSvgId("sl-ring");
  if (reduced) return null;
  const along = (lag: number) => (
    <animateMotion dur={`${DIAMOND_LAP_S}s`} repeatCount="indefinite" begin={`-${(DIAMOND_LAP_S - lag).toFixed(2)}s`}>
      <mpath href={`#${orbit}`} />
    </animateMotion>
  );
  return (
    <svg className="sl-orbit-fx" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <path id={orbit} d={ORBIT} fill="none" />
        {RINGS.map((r, i) => (
          <path key={i} id={`${ring}-${i}`} d={ellipse(r)} fill="none" />
        ))}
        <linearGradient id={gem} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="sl-stop-light" />
          <stop offset="0.45" className="sl-stop-ice" />
          <stop offset="0.7" className="sl-stop-lilac" />
          <stop offset="1" className="sl-stop-light" />
        </linearGradient>
      </defs>
      {RINGS.map((r, i) => {
        // The path starts at the left point; clockwise passes the far (top) side first.
        const depth = r.cw ? "0.8;0.5;0.8;1.15;0.8" : "0.8;1.15;0.8;0.5;0.8";
        const fade = r.cw ? "0.85;0.35;0.85;1;0.85" : "0.85;1;0.85;0.35;0.85";
        return (
          <g key={i} transform={`rotate(${r.tilt} 50 70)`}>
            {Array.from({ length: r.gems }, (_, k) => {
              const begin = `-${((r.lap * k) / r.gems + i * 1.7).toFixed(2)}s`;
              return (
                <g key={k} className="sl-satellite" style={{ animationDelay: `${(i * 0.37 + k * 0.53).toFixed(2)}s` }}>
                  <animateMotion dur={`${r.lap}s`} repeatCount="indefinite" begin={begin}>
                    <mpath href={`#${ring}-${i}`} />
                  </animateMotion>
                  <g transform={`rotate(${-r.tilt})`}>
                    <g>
                      <animateTransform attributeName="transform" type="scale" values={depth} keyTimes="0;0.25;0.5;0.75;1" dur={`${r.lap}s`} begin={begin} repeatCount="indefinite" />
                      <animate attributeName="opacity" values={fade} keyTimes="0;0.25;0.5;0.75;1" dur={`${r.lap}s`} begin={begin} repeatCount="indefinite" />
                      <Gem fill={`url(#${gem})`} scale={r.size} />
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
      {TRAIL.map((n) => (
        <g key={n}>
          {along(n * 0.07)}
          <circle className="sl-trail" r={1.1 - n * 0.16} style={{ opacity: 1 - n * 0.17 }} />
        </g>
      ))}
      <g>
        {along(0)}
        <Gem fill={`url(#${gem})`} scale={1.3} />
      </g>
    </svg>
  );
}

/** Shiny: SVG filter mapping the photo to an inverted navy-blue / white neon duotone with a soft bloom. */
export function NeonInvertFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" />
        {/* Inverted duotone: dark tones become white, bright tones become deep navy blue. */}
        <feComponentTransfer result="duo">
          <feFuncR type="table" tableValues="0.98 0.86 0.3 0.06 0.03" />
          <feFuncG type="table" tableValues="0.99 0.9 0.4 0.12 0.07" />
          <feFuncB type="table" tableValues="1 1 0.78 0.38 0.24" />
        </feComponentTransfer>
        <feGaussianBlur in="duo" stdDeviation="2.5" result="bloom" />
        <feBlend in="duo" in2="bloom" mode="screen" />
      </filter>
    </svg>
  );
}

export function useNeonFilterId() {
  return useSvgId("gm-neon");
}

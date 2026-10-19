import { useEffect, useRef, type ReactNode } from "react";
import { fireSprites, toRgb } from "@/components/CardFire";
import { cn } from "@/lib/utils";
import { BREATH_FIRE_MS, BREATH_TOTAL_MS, BREATH_WINDUP_MS, breathIntensity, nextBreathDelay } from "@/lib/dragon-breath";
import { bodyRadius, headDistance, makeCrawl, perimeter, smoothPointAt, smoothstep, type Rect } from "@/lib/dragon-path";
import dragonHead from "@/assets/dragon/su-dragon-profile.webp";
import dragonClaw from "@/assets/dragon/su-dragon-claw.webp";

// Overlay canvas reaches this far past the card (fractions of the card's width / height); matches .su-dragon in styles.css.
const PAD_X = 0.13;
const PAD_Y = 0.09;
const NECK_R = 0.034; // neck radius, fraction of card width
const BODY_LEN = 0.55; // share of the border the body covers
const OUTSET = 0.004; // body centre line sits just outside the card edge
const CORNER_R = 0.13; // path corner radius, fraction of card width (wider than the card's so the turn is gentle)
const TURN_WIN = 0.07; // path blur half-window, fraction of card width: spreads each corner turn over a long curve
// Head picture (side profile facing right, neck leaving the left edge): neck centre and mouth, as fractions of its box.
const HEAD = { neckY: 0.54, neckH: 0.53, mouthX: 0.8, mouthY: 0.58, aspect: 2 };

type Rgb = [number, number, number];
interface Flame { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; grow: number; ember: boolean; seed: number }

const rgb = (c: Rgb, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;

/** One body segment in local space (+x towards the head, +y towards the card): red metal back, gold belly, dark rim so overlapping segments read as scales. */
function segmentSprite(el: Element): HTMLCanvasElement {
  const css = getComputedStyle(el);
  const get = (name: string, fb: Rgb) => toRgb(css.getPropertyValue(name).trim(), fb);
  const deep = get("--su-metal-deep", [70, 10, 10]);
  const metal = get("--su-metal", [160, 25, 25]);
  const bright = get("--su-metal-bright", [225, 50, 45]);
  const spec = get("--su-metal-spec", [255, 220, 215]);
  const gold = get("--gold-bright", [245, 200, 90]);
  const goldDeep = get("--gold-deep", [150, 95, 30]);
  const S = 64, R = 30;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.clip();
  const body = g.createLinearGradient(0, S / 2 - R, 0, S / 2 + R);
  body.addColorStop(0, rgb(deep)); body.addColorStop(0.24, rgb(bright)); body.addColorStop(0.5, rgb(metal));
  body.addColorStop(0.66, rgb(goldDeep)); body.addColorStop(0.8, rgb(gold)); body.addColorStop(1, rgb(goldDeep));
  g.fillStyle = body; g.fillRect(0, 0, S, S);
  const glint = g.createRadialGradient(S / 2 + 4, S / 2 - R * 0.45, 1, S / 2 + 4, S / 2 - R * 0.45, R * 0.6);
  glint.addColorStop(0, rgb(spec, 0.75)); glint.addColorStop(1, rgb(spec, 0));
  g.fillStyle = glint; g.fillRect(0, 0, S, S);
  const rim = g.createRadialGradient(S / 2 + 5, S / 2, R * 0.55, S / 2, S / 2, R);
  rim.addColorStop(0, rgb(deep, 0)); rim.addColorStop(1, rgb(deep, 0.85));
  g.fillStyle = rim; g.fillRect(0, 0, S, S);
  return c;
}

/** Dorsal spike pointing up (-y), gold to ivory. */
function spikeSprite(el: Element): HTMLCanvasElement {
  const css = getComputedStyle(el);
  const gold = toRgb(css.getPropertyValue("--gold-bright").trim(), [245, 200, 90]);
  const deep = toRgb(css.getPropertyValue("--su-metal-deep").trim(), [70, 10, 10]);
  const c = document.createElement("canvas");
  c.width = 32; c.height = 48;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 48, 0, 0);
  grad.addColorStop(0, rgb(deep)); grad.addColorStop(0.5, rgb(gold)); grad.addColorStop(1, "rgba(255,248,230,1)");
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(2, 48); g.quadraticCurveTo(20, 30, 26, 0); g.quadraticCurveTo(24, 26, 30, 48); g.closePath(); g.fill();
  return c;
}

/**
 * Secret Ultimate shell: a 2D red-metal dragon crawls clockwise round the card's border, gold belly and claws
 * against the card, spikes outward, and every few seconds (random per card) it rears its head and breathes a
 * particle fire jet along the edge that lights the card. Start point and speed are random per card.
 */
export function SuDragonShell({ className, missing, children }: { className?: string | undefined; missing?: boolean | undefined; children: ReactNode }) {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = shell.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fire = fireSprites(cv);
    const top = fire.length - 1;
    const seg = segmentSprite(cv);
    const spike = spikeSprite(cv);
    const head = new Image(); head.decoding = "async"; head.src = dragonHead;
    const claw = new Image(); claw.decoding = "async"; claw.src = dragonClaw;
    const crawl = makeCrawl();

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); if (still) draw(0, -1, 0); });
    ro.observe(cv);

    const parts: Flame[] = [];
    let raf = 0, last = 0, running = false, acc = 0, embers = 0, t = 0;
    let breathAt = -1;
    // Previous mouth position / heading, so particles born during a frame spread along the mouth's motion (no dotted jet).
    let pmx = NaN, pmy = NaN, pHeading = 0, glowS = 0.12, headA = NaN;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (ms: number) => { clearTimeout(timer); timer = setTimeout(breathe, ms); };
    const breathe = () => {
      if (!running) return;
      breathAt = performance.now();
      el.classList.add("is-breathing");
      timer = setTimeout(() => { el.classList.remove("is-breathing"); breathAt = -1; schedule(nextBreathDelay()); }, BREATH_TOTAL_MS);
    };

    // Draws the whole scene; returns the mouth position and fire heading for the breath particles.
    const draw = (time: number, ms: number, dt: number) => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      const u = cw / 100;
      const o = OUTSET * cw;
      const rect: Rect = { x: PAD_X * cw - o, y: PAD_Y * ch - o, w: cw + 2 * o, h: ch + 2 * o, r: CORNER_R * cw };
      const P = perimeter(rect);
      const L = BODY_LEN * P;
      const r0 = NECK_R * cw;
      const sHead = headDistance(crawl, P, time);
      const N = Math.max(24, Math.ceil(L / (r0 * 0.45)));
      const k = ms < 0 ? 0 : breathIntensity(ms);

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      // Position on the body: u = 0 at the neck, 1 at the tail; a soft slither keeps it alive without leaving the edge.
      const win = TURN_WIN * cw;
      const at = (q: number) => {
        const p = smoothPointAt(rect, sHead - q * L, win);
        const off = (0.9 * u) * Math.sin(q * 15 - time * 3.2 + crawl.wiggle) * (0.3 + q);
        return { x: p.x - p.ty * off, y: p.y + p.tx * off, a: Math.atan2(p.ty, p.tx) };
      };

      // Claws reach onto the card from just behind the neck and near the hips.
      if (claw.complete && claw.naturalWidth) {
        for (const q of [0.14, 0.52]) {
          const p = at(q);
          const cwid = 0.16 * cw * (q > 0.3 ? 0.85 : 1);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
          ctx.drawImage(claw, -cwid * 0.15, -cwid * 0.12, cwid, cwid);
          ctx.restore();
        }
      }

      // Body from tail to neck so each segment overlaps the one behind it like scales; spikes on the outer side.
      for (let i = N; i >= 0; i--) {
        const q = i / N;
        const rad = r0 * bodyRadius(q);
        if (rad < 0.4) continue;
        const p = at(q);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        if (i % 6 === 0 && q < 0.9) ctx.drawImage(spike, -rad * 0.45, -rad * 1.95, rad * 0.9, rad * 1.35);
        ctx.drawImage(seg, -rad, -rad, rad * 2, rad * 2);
        ctx.restore();
      }
      // Tail tip: a gold spade pointing backwards.
      {
        const p = at(1), b = at(0.97);
        const s = r0 * 1.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2);
        ctx.drawImage(spike, -s * 0.5, -s * 1.3, s, s * 1.5);
        ctx.restore();
      }

      // Head rears up (away from the card) while drawing breath, then lunges forward to breathe.
      let lift = 0;
      if (ms >= 0) {
        const fireEnd = BREATH_WINDUP_MS + BREATH_FIRE_MS;
        lift = ms < BREATH_WINDUP_MS ? -0.22 * smoothstep(ms / BREATH_WINDUP_MS)
          : ms < fireEnd ? -0.22 + 0.14 * smoothstep((ms - BREATH_WINDUP_MS) / 220)
          : -0.08 * (1 - smoothstep((ms - fireEnd) / (BREATH_TOTAL_MS - fireEnd)));
      }
      const hp = at(0);
      // The head follows the body's heading through a light low-pass, so it glides round corners instead of twitching.
      const target = hp.a + lift;
      if (Number.isNaN(headA) || dt <= 0) headA = target;
      else {
        const d = Math.atan2(Math.sin(target - headA), Math.cos(target - headA));
        headA += d * (1 - Math.exp(-dt * 14));
      }
      const ha = headA;
      const Hh = (2 * r0) / HEAD.neckH, Hw = Hh * HEAD.aspect;
      if (head.complete && head.naturalWidth) {
        ctx.save(); ctx.translate(hp.x, hp.y); ctx.rotate(ha);
        ctx.drawImage(head, -Hw * 0.04, -Hh * HEAD.neckY, Hw, Hh);
        ctx.restore();
      }
      const lx = Hw * (HEAD.mouthX - 0.04), ly = Hh * (HEAD.mouthY - HEAD.neckY);
      const mx = hp.x + lx * Math.cos(ha) - ly * Math.sin(ha);
      const my = hp.y + lx * Math.sin(ha) + ly * Math.cos(ha);

      ctx.globalCompositeOperation = "lighter";
      // Flame light washing over the card around the mouth while it breathes, a faint smoulder otherwise.
      const glowT = ms < 0 ? 0.12 : ms < BREATH_WINDUP_MS ? 0.12 + 0.4 * smoothstep(ms / BREATH_WINDUP_MS) : Math.max(0.12, 0.6 * k);
      glowS = dt > 0 ? glowS + (glowT - glowS) * (1 - Math.exp(-dt * 9)) : glowT;
      const glow = glowS;
      ctx.globalAlpha = glow * 0.6;
      // Centred a little onto the card and kept clear of the overlay's edges, so the light never shows a clipped box.
      const nx = -Math.sin(ha), ny = Math.cos(ha);
      const gx = mx + nx * 6 * u, gy = my + ny * 6 * u;
      const gr = Math.max(0, Math.min((14 + 26 * glow) * u, gx, gy, w - gx, h - gy));
      if (gr > 1) ctx.drawImage(fire[Math.floor(top * 0.55)]!, gx - gr, gy - gr, gr * 2, gr * 2);

      const heading = ha + 0.1; // along the edge, leaning onto the card so the jet stays inside the overlay and lights the frame
      if (Number.isNaN(pmx)) { pmx = mx; pmy = my; pHeading = heading; }
      if (dt > 0) {
        // Head velocity: the jet is carried a little by the moving head.
        const hvx = (mx - pmx) / dt, hvy = (my - pmy) / dt;
        const dh = Math.atan2(Math.sin(heading - pHeading), Math.cos(heading - pHeading));
        acc += dt * k * Math.max(420, cw * 5);
        while (acc > 1 && parts.length < 700) {
          acc -= 1;
          // Born at a random instant inside this frame: start on the mouth's path and already advanced by the time left.
          const f = Math.random();
          const a = pHeading + dh * f + (Math.random() - 0.5) * 0.3;
          const sp = (75 + Math.random() * 30) * u;
          const vx = Math.cos(a) * sp + hvx * 0.35, vy = Math.sin(a) * sp + hvy * 0.35;
          // The update loop below advances every particle by dt, so start it dt earlier than its true age.
          const lead = (1 - f) * dt - dt;
          parts.push({ x: pmx + (mx - pmx) * f + vx * lead, y: pmy + (my - pmy) * f + vy * lead, vx, vy, age: lead, life: 0.5 + Math.random() * 0.25, size: (1.6 + Math.random() * 1) * u, grow: (5 + Math.random() * 4.5) * u, ember: false, seed: Math.random() * 1000 });
        }
        if (acc > 1) acc = 0;
        embers += dt * (2 + k * 24);
        while (embers > 1) {
          embers -= 1;
          parts.push({ x: mx, y: my, vx: (Math.random() * 10 - 5) * u, vy: -(6 + Math.random() * 8) * u, age: 0, life: 0.7 + Math.random() * 0.6, size: (1 + Math.random() * 1.2) * u, grow: 0, ember: true, seed: Math.random() * 1000 });
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.age += dt;
        const q = p.age / p.life;
        if (q >= 1) { parts.splice(i, 1); continue; }
        if (p.ember) {
          p.x += (p.vx + Math.sin(p.seed + time * 5) * 4 * u) * dt;
          p.y += p.vy * dt;
          ctx.globalAlpha = (1 - q) * 0.8;
          ctx.drawImage(fire[Math.floor((0.3 + q * 0.4) * top)]!, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          continue;
        }
        const drag = Math.exp(-1.6 * dt);
        p.vx *= drag; p.vy *= drag;
        p.vy -= 18 * u * dt;
        // Gentle per-particle turbulence (own phase and slower rate) so the jet billows instead of jittering.
        p.x += (p.vx + Math.sin(p.seed + time * 6 + q * 4) * 7 * u * q) * dt;
        p.y += (p.vy + Math.cos(p.seed * 1.7 + time * 5 + q * 3) * 5 * u * q) * dt;
        const size = p.size + (p.grow - p.size) * Math.sqrt(q);
        const stretch = Math.min(2.8, 1 + Math.hypot(p.vx, p.vy) / (40 * u));
        ctx.globalAlpha = (q < 0.12 ? smoothstep(q / 0.12) : Math.pow(1 - q, 1.1)) * 0.15;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.drawImage(fire[Math.min(top, Math.floor((0.12 + 0.88 * Math.pow(q, 0.85)) * fire.length))]!, (-size * stretch) / 2, -size / 2, size * stretch, size);
        ctx.restore();
      }
      pmx = mx; pmy = my; pHeading = heading;
      ctx.globalAlpha = 1;
      // Feather the overlay's outer edges so flames and light drifting outwards fade out instead of being cut off square.
      ctx.globalCompositeOperation = "destination-out";
      const band = Math.min(0.045 * cw, w / 4, h / 4);
      const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
      };
      fade(0, 0, 0, band, 0, 0, w, band);
      fade(0, h, 0, h - band, 0, h - band, w, band);
      fade(0, 0, band, 0, 0, 0, band, h);
      fade(w, 0, w - band, 0, w - band, 0, band, h);
      ctx.globalCompositeOperation = "source-over";
    };

    if (still) {
      const once = () => draw(0, -1, 0);
      head.onload = once; claw.onload = once; once();
      return () => { ro.disconnect(); };
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      draw(t, breathAt < 0 ? -1 : now - breathAt, dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true; last = performance.now(); raf = requestAnimationFrame(tick);
      schedule(800 + Math.random() * 3000);
    };
    const stop = () => {
      running = false; cancelAnimationFrame(raf); clearTimeout(timer);
      el.classList.remove("is-breathing"); breathAt = -1; parts.length = 0; pmx = NaN; headA = NaN;
    };
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()), { rootMargin: "100px" });
    io.observe(el);
    return () => { stop(); io.disconnect(); ro.disconnect(); };
  }, []);

  return (
    <div ref={shell} className={cn("su-shell", missing && "is-missing", className)}>
      {children}
      <canvas ref={canvas} className="su-dragon" aria-hidden="true" />
    </div>
  );
}

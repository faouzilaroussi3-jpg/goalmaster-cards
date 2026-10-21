import { useEffect, useRef, type RefObject } from "react";
import { toRgb } from "@/components/CardFire";
import type { RareFx } from "@/lib/rare-reveal";

type Rgb = [number, number, number];
type Kind = "streak" | "glow" | "shard" | "flame";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number;
  color: number; kind: Kind; rot: number; vr: number;
  drag: number; lift: number; inward?: boolean;
}

interface Palette {
  colors: Rgb[];
  core: Rgb;
  backdrop?: Rgb;
  rays: number;
  burst: number;
  kinds: Kind[];
}

const SPRITE = 64;

function sprite(c: Rgb) {
  const s = document.createElement("canvas");
  s.width = s.height = SPRITE;
  const g = s.getContext("2d")!;
  const h = SPRITE / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, `rgba(${c[0]},${c[1]},${c[2]},0.95)`);
  grad.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.35)`);
  grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return s;
}

/** Soft, lumpy smoke puff (several offset blobs with grain) in one colour. */
function smokeSprite(c: Rgb) {
  const N = 128, s = document.createElement("canvas");
  s.width = s.height = N;
  const g = s.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const x = N / 2 + (Math.random() - 0.5) * N * 0.38, y = N / 2 + (Math.random() - 0.5) * N * 0.38, r = N * (0.18 + Math.random() * 0.22);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.32)`);
    grad.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},0.12)`);
    grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, N, N);
  }
  // Grain so the puff reads as smoke rather than a flat glow.
  const img = g.getImageData(0, 0, N, N);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! * (0.7 + Math.random() * 0.3);
  g.putImageData(img, 0, 0);
  return s;
}

interface Puff { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; grow: number; rot: number; vr: number; color: number; alpha: number; drag: number; rise: number }

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A rarity's own tint (chosen by the admin) leads the burst; fire keeps its flame colours. */
function tinted(pal: Palette, fx: RareFx, tint: string | null | undefined): Palette {
  if (!tint || fx === "secret_ultimate") return pal;
  const c = toRgb(tint, pal.core);
  const light = mix(c, [255, 255, 255], 0.55);
  return { ...pal, core: c, colors: [c, light, c, ...pal.colors.slice(0, 2)] };
}

/** Colours come from the theme tokens so each burst matches its card frame. */
function palette(fx: RareFx, el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const tok = (name: string, fb: Rgb) => toRgb(css.getPropertyValue(name).trim(), fb);
  const white = tok("--card-light", [255, 255, 255]);
  switch (fx) {
    case "legendary": {
      const gold = tok("--r-legendary", [240, 196, 70]);
      return { colors: [gold, tok("--gold-bright", [255, 240, 170]), tok("--gold-deep", [170, 120, 30]), white], core: gold, rays: 14, burst: 230, kinds: ["streak", "streak", "glow"] };
    }
    case "alt": {
      const colors = ["--flame-outer", "--r-legendary", "--r-uncommon", "--r-sr", "--r-rare", "--diamond-lilac"].map((n) => tok(n, [255, 120, 200]));
      return { colors, core: white, rays: 18, burst: 280, kinds: ["streak", "streak", "glow"] };
    }
    case "secret_legendary":
      return { colors: [white, tok("--diamond-ice", [170, 215, 245]), tok("--r-sl", [225, 232, 250]), tok("--diamond-lilac", [215, 195, 245])], core: tok("--diamond-ice", [170, 215, 245]), rays: 24, burst: 240, kinds: ["shard", "shard", "streak", "glow"] };
    case "shiny":
      return { colors: [white, tok("--neon-ice", [240, 245, 255]), tok("--neon-blue", [70, 110, 240])], core: tok("--neon-blue", [70, 110, 240]), backdrop: tok("--neon-navy", [18, 28, 80]), rays: 20, burst: 260, kinds: ["streak", "streak", "glow"] };
    case "secret_ultimate": {
      const core = tok("--flame-core", [255, 244, 190]);
      const mid = tok("--flame-mid", [255, 150, 30]);
      const outer = tok("--flame-outer", [215, 40, 20]);
      const dark = tok("--flame-dark", [80, 12, 8]);
      const colors = Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        return t < 0.3 ? mix(core, mid, t / 0.3) : t < 0.7 ? mix(mid, outer, (t - 0.3) / 0.4) : mix(outer, dark, (t - 0.7) / 0.3);
      });
      return { colors, core: mid, backdrop: dark, rays: 0, burst: 360, kinds: ["flame", "flame", "flame", "streak"] };
    }
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Full-screen glow and explosion for Légendaire-or-better reveals: light gathers into the card,
 * explodes in a cloud of smoke in the rarity's colours when its face appears, then lingers. Gold for Légendaire, rainbow for ALT, diamond shards
 * for Secrète Légendaire, navy/white neon for Shiny, fire for Secrète Ultime. Skipped for reduced motion.
 */
export function RareRevealFx({ fx, tint, boomAt, total, anchor }: { fx: RareFx; tint?: string | null; boomAt: number; total: number; anchor: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pal = tinted(palette(fx, canvas), fx, tint);
    const sprites = pal.colors.map(sprite);
    const fire = fx === "secret_ultimate";
    const rainbow = fx === "alt";
    // Smoke in the pulled rarity's colours: its own tone, a lighter wisp and a deeper shade.
    const smokeCols: Rgb[] = fire
      ? [pal.colors[6]!, pal.colors[9]!, pal.colors[4]!]
      : rainbow ? pal.colors.slice(0, 6) : [pal.core, mix(pal.core, [255, 255, 255], 0.45), mix(pal.core, [0, 0, 0], 0.35)];
    const smokes = smokeCols.map(smokeSprite);
    const puffs: Puff[] = [];
    let puffAcc = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const ps: Particle[] = [];
    const start = performance.now();
    let last = start;
    let boomed = false;
    let raf = 0;
    let spawnAcc = 0;

    const center = () => {
      const r = anchor.current?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : { x: W / 2, y: H / 2, w: 200, h: 280 };
    };
    const pickKind = () => pal.kinds[(Math.random() * pal.kinds.length) | 0]!;
    const pickColor = () => (Math.random() * pal.colors.length) | 0;

    function explode(cx: number, cy: number) {
      for (let i = 0; i < pal.burst; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(260, fire ? 1000 : 1400) * (Math.random() < 0.25 ? 0.45 : 1);
        const kind = pickKind();
        ps.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          age: 0, life: rand(0.9, 2.3), size: kind === "flame" ? rand(26, 60) : kind === "shard" ? rand(5, 12) : rand(8, 22),
          color: rainbow ? Math.floor(((a / (Math.PI * 2)) * pal.colors.length)) % pal.colors.length : fire ? 0 : pickColor(),
          kind, rot: Math.random() * Math.PI, vr: rand(-6, 6), drag: kind === "flame" ? 2.6 : 1.8, lift: kind === "flame" ? -260 : 40,
        });
      }
    }

    function spawn(dt: number, t: number, c: ReturnType<typeof center>) {
      const building = t < boomAt;
      const after = (t - boomAt) / Math.max(1, total - boomAt);
      const rate = building ? 60 + 260 * (t / boomAt) : Math.max(0, 170 * (1 - after));
      spawnAcc += rate * dt;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const kind = pickKind();
        if (building) {
          // Light (or fire) is sucked into the card before it explodes.
          const a = Math.random() * Math.PI * 2;
          const d = rand(Math.max(c.w, c.h) * 0.9, Math.max(W, H) * 0.55);
          const sp = rand(380, 720);
          const swirl = fire ? 0.55 : fx === "secret_legendary" ? 0.25 : 0.12;
          const dir = a + Math.PI + swirl;
          ps.push({
            x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
            age: 0, life: d / sp, size: kind === "flame" ? rand(18, 40) : kind === "shard" ? rand(4, 9) : rand(6, 14),
            color: fire ? 2 : pickColor(), kind, rot: Math.random() * Math.PI, vr: rand(-4, 4), drag: 0, lift: 0, inward: true,
          });
        } else {
          // Lingering sparks (or flames licking up) around the card.
          const side = Math.random();
          const x = c.x + (side < 0.5 ? rand(-0.6, 0.6) * c.w : (side < 0.75 ? -0.55 : 0.55) * c.w);
          const y = fire ? c.y + c.h * rand(0.2, 0.55) : c.y + rand(-0.6, 0.6) * c.h;
          ps.push({
            x, y, vx: rand(-40, 40), vy: fire ? rand(-260, -120) : rand(-90, -20),
            age: 0, life: rand(0.8, 1.8), size: kind === "flame" ? rand(22, 46) : kind === "shard" ? rand(4, 9) : rand(5, 12),
            color: fire ? 0 : pickColor(), kind, rot: Math.random() * Math.PI, vr: rand(-3, 3), drag: 0.6, lift: fire ? -160 : -20,
          });
        }
      }
    }

    function drawParticle(p: Particle, fade: number) {
      const k = p.age / p.life;
      const alpha = (p.inward ? Math.min(1, k * 3) : 1 - k) * fade;
      if (alpha <= 0) return;
      if (p.kind === "flame") {
        const idx = Math.min(pal.colors.length - 1, Math.floor(k * pal.colors.length));
        const s = p.size * (1 - k * 0.5);
        ctx!.globalAlpha = alpha * 0.85;
        ctx!.drawImage(sprites[idx]!, p.x - s / 2, p.y - s / 2, s, s);
        return;
      }
      const col = pal.colors[p.color]!;
      if (p.kind === "shard") {
        const s = p.size * (1 - k * 0.3);
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx!.beginPath();
        ctx!.moveTo(0, -s * 1.5); ctx!.lineTo(s * 0.8, 0); ctx!.lineTo(0, s * 1.5); ctx!.lineTo(-s * 0.8, 0);
        ctx!.closePath();
        ctx!.fill();
        ctx!.globalAlpha = alpha * 0.6;
        ctx!.drawImage(sprites[0]!, -s * 2, -s * 2, s * 4, s * 4);
        ctx!.restore();
        return;
      }
      if (p.kind === "streak") {
        const len = 0.045;
        ctx!.globalAlpha = alpha;
        ctx!.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx!.lineWidth = Math.max(1, p.size * 0.22);
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y);
        ctx!.lineTo(p.x - p.vx * len, p.y - p.vy * len);
        ctx!.stroke();
      }
      const s = p.size;
      ctx!.globalAlpha = alpha * (p.kind === "glow" ? 0.9 : 0.5);
      ctx!.drawImage(sprites[p.color]!, p.x - s / 2, p.y - s / 2, s, s);
    }

    function ring(cx: number, cy: number, since: number, speed: number, width: number) {
      if (since < 0 || since > 1.1) return;
      const r = since * speed;
      const a = 1 - since / 1.1;
      ctx!.lineWidth = width * a + 1;
      if (rainbow) {
        const n = pal.colors.length * 4;
        for (let i = 0; i < n; i++) {
          const c = pal.colors[i % pal.colors.length]!;
          ctx!.globalAlpha = a;
          ctx!.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx!.beginPath();
          ctx!.arc(cx, cy, r, (i / n) * Math.PI * 2 + since * 2, ((i + 1) / n) * Math.PI * 2 + since * 2);
          ctx!.stroke();
        }
        return;
      }
      const c = fire ? pal.colors[2]! : pal.colors[1] ?? pal.core;
      ctx!.globalAlpha = a;
      ctx!.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.stroke();
    }

    function addPuff(p: Omit<Puff, "age" | "rot" | "vr" | "color">) {
      puffs.push({ ...p, age: 0, rot: Math.random() * Math.PI * 2, vr: rand(-0.35, 0.35), color: (Math.random() * smokes.length) | 0 });
    }

    function smokeBurst(cx: number, cy: number, c: ReturnType<typeof center>) {
      const big = Math.max(c.w, c.h);
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, sp = rand(160, 620);
        addPuff({ x: cx + Math.cos(a) * big * 0.15, y: cy + Math.sin(a) * big * 0.15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: rand(1.8, 3.2), size: big * rand(0.45, 0.9), grow: rand(1.4, 2.4), alpha: rand(0.55, 0.85), drag: 1.9, rise: fire ? -70 : -35 });
      }
    }

    function smoke(dt: number, t: number, c: ReturnType<typeof center>, fade: number) {
      const big = Math.max(c.w, c.h);
      const building = t < boomAt;
      const after = (t - boomAt) / Math.max(1, total - boomAt);
      const rate = t > total - 600 ? 0 : building ? 10 + 26 * (t / boomAt) : Math.max(4, 22 * (1 - after));
      puffAcc += rate * dt;
      while (puffAcc >= 1) {
        puffAcc -= 1;
        if (building) {
          // Drifts in slowly from all around and thickens behind the card.
          const a = Math.random() * Math.PI * 2, d = big * rand(0.7, 1.5);
          addPuff({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: -Math.cos(a) * rand(30, 70), vy: -Math.sin(a) * rand(30, 70),
            life: rand(1.4, 2.4), size: big * rand(0.35, 0.6), grow: rand(0.8, 1.3), alpha: rand(0.35, 0.6), drag: 0.4, rise: -10 });
        } else {
          // Billows rising from behind the card's sides and base.
          const side = Math.random();
          const x = c.x + (side < 0.6 ? rand(-0.55, 0.55) * c.w : (side < 0.8 ? -0.6 : 0.6) * c.w);
          addPuff({ x, y: c.y + c.h * rand(0.05, 0.5), vx: rand(-40, 40), vy: rand(-90, -40),
            life: rand(2, 3.4), size: big * rand(0.4, 0.75), grow: rand(1.2, 2), alpha: rand(0.35, 0.6), drag: 0.3, rise: fire ? -60 : -25 });
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]!;
        p.age += dt;
        if (p.age >= p.life) { puffs.splice(i, 1); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.rise * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const k = p.age / p.life;
        const env = Math.min(1, k / 0.2) * (1 - k) * (1 - k);
        const sz = p.size * (1 + (p.grow - 1) * k);
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = p.alpha * env * fade;
        ctx!.drawImage(smokes[p.color]!, -sz / 2, -sz / 2, sz, sz);
        ctx!.restore();
      }
    }

    function frame(now: number) {
      const t = now - start;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = center();
      const fade = t > total - 700 ? Math.max(0, (total - t) / 700) : 1;
      const build = Math.min(1, t / boomAt);
      const since = (t - boomAt) / 1000;

      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = 1;
      ctx!.clearRect(0, 0, W, H);

      // Backdrop: navy night for Shiny, smouldering dark red for Secrète Ultime.
      if (pal.backdrop) {
        const b = pal.backdrop;
        const g = ctx!.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(${b[0]},${b[1]},${b[2]},${0.25 * build * fade})`);
        g.addColorStop(1, `rgba(${b[0]},${b[1]},${b[2]},${0.85 * build * fade})`);
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, W, H);
      }

      ctx!.globalCompositeOperation = "lighter";

      // Core glow behind the card: grows during the build-up, swells at the explosion, then breathes.
      const pulse = 1 + Math.sin(t / 90) * 0.06 * build;
      const coreR = (since < 0 ? 80 + 260 * build * build : 420 - Math.min(1, since) * 120) * pulse;
      const coreA = (since < 0 ? 0.35 + 0.55 * build : Math.max(0.55, 1 - since * 0.4)) * fade;
      const core = rainbow ? pal.colors[Math.floor(t / 140) % pal.colors.length]! : pal.core;
      const cg = ctx!.createRadialGradient(c.x, c.y, 0, c.x, c.y, coreR);
      cg.addColorStop(0, `rgba(255,255,255,${coreA})`);
      cg.addColorStop(0.25, `rgba(${core[0]},${core[1]},${core[2]},${coreA * 0.8})`);
      cg.addColorStop(1, `rgba(${core[0]},${core[1]},${core[2]},0)`);
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = cg;
      ctx!.fillRect(c.x - coreR, c.y - coreR, coreR * 2, coreR * 2);

      // Coloured smoke: gathers round the card during the build-up, bursts out with the explosion, then billows up.
      ctx!.globalCompositeOperation = "source-over";
      smoke(dt, t, c, fade);
      ctx!.globalCompositeOperation = "lighter";

      if (!boomed && t >= boomAt) { boomed = true; explode(c.x, c.y); smokeBurst(c.x, c.y, c); }
      if (t < total - 300) spawn(dt, t, c);

      // Shockwaves.
      if (boomed) {
        const speed = Math.max(W, H) * 1.1;
        ring(c.x, c.y, since, speed, fire ? 34 : 22);
        ring(c.x, c.y, since - 0.18, speed * 0.8, 14);
        ring(c.x, c.y, since - 0.38, speed * 0.6, 8);
      }

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.age += dt;
        if (p.age >= p.life) { ps.splice(i, 1); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.lift * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        drawParticle(p, fade);
      }

      // Explosion flash, strongest right as the card face appears.
      if (since >= 0 && since < 0.45) {
        const fa = (1 - since / 0.45) * 0.75;
        const fl = fx === "shiny" ? pal.colors[0]! : pal.core;
        ctx!.globalCompositeOperation = "lighter";
        ctx!.globalAlpha = fa;
        const fg = ctx!.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(W, H) * 0.7);
        fg.addColorStop(0, "rgba(255,255,255,1)");
        fg.addColorStop(0.35, `rgba(${fl[0]},${fl[1]},${fl[2]},0.8)`);
        fg.addColorStop(1, `rgba(${fl[0]},${fl[1]},${fl[2]},0)`);
        ctx!.fillStyle = fg;
        ctx!.fillRect(0, 0, W, H);
      }

      if (t < total) raf = requestAnimationFrame(frame);
      else ctx!.clearRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [fx, tint, boomAt, total, anchor]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}

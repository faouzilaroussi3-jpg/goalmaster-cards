import { useEffect, useRef } from "react";

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; seed: number }

const STEPS = 24;
type Rgb = [number, number, number];

/** Resolve a CSS color (any syntax the browser knows, e.g. oklch tokens) to RGB through a 1px canvas. */
export function toRgb(color: string, fallback: Rgb): Rgb {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x || !color) return fallback;
  x.fillStyle = `rgb(${fallback.join(",")})`;
  x.fillStyle = color;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0] ?? fallback[0], d[1] ?? fallback[1], d[2] ?? fallback[2]];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Pre-tinted soft fire sprites, white-hot core → orange → red → ember, from the theme's flame tokens on `el`. */
export function fireSprites(el: Element): HTMLCanvasElement[] {
  const css = getComputedStyle(el);
  const core = toRgb(css.getPropertyValue("--flame-core").trim(), [255, 244, 190]);
  const mid = toRgb(css.getPropertyValue("--flame-mid").trim(), [255, 150, 30]);
  const outer = toRgb(css.getPropertyValue("--flame-outer").trim(), [215, 40, 20]);
  const dark = toRgb(css.getPropertyValue("--flame-dark").trim(), [80, 12, 8]);
  const ramp = (t: number): Rgb => (t < 0.25 ? mix(core, mid, t / 0.25) : t < 0.6 ? mix(mid, outer, (t - 0.25) / 0.35) : mix(outer, dark, (t - 0.6) / 0.4));
  return Array.from({ length: STEPS }, (_, i) => {
    const [r, g, b] = ramp(i / (STEPS - 1)).map(Math.round) as Rgb;
    const s = document.createElement("canvas");
    s.width = s.height = 48;
    const sx = s.getContext("2d")!;
    const grad = sx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.75)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    sx.fillStyle = grad;
    sx.fillRect(0, 0, 48, 48);
    return s;
  });
}

/**
 * Realistic fire burning along the card edges: hundreds of additive particles that are born white-hot,
 * cool through orange and red, sway with turbulence and fade out as they rise. Burns twice as hard while
 * the SU dragon breathes fire (.su-shell.is-breathing). Paused off-screen and skipped for reduced motion.
 */
export function CardFire({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sprites = fireSprites(canvas);
    const shell = canvas.closest(".su-shell");

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const parts: Particle[] = [];
    const spawn = () => {
      const u = w / 100; // 1% of card width
      const pick = Math.random();
      let x: number, y: number, vx: number, vy: number, life: number, size: number;
      if (pick < 0.34) {
        // left edge, licking up and slightly inward
        x = Math.random() * 3 * u; y = h * (0.18 + Math.random() * 0.86);
        vx = (Math.random() * 6 - 1) * u; vy = -(22 + Math.random() * 28) * u; life = 0.45 + Math.random() * 0.55; size = (8 + Math.random() * 11) * u;
      } else if (pick < 0.68) {
        x = w - Math.random() * 3 * u; y = h * (0.18 + Math.random() * 0.86);
        vx = -(Math.random() * 6 - 1) * u; vy = -(22 + Math.random() * 28) * u; life = 0.45 + Math.random() * 0.55; size = (8 + Math.random() * 11) * u;
      } else if (pick < 0.94) {
        // bottom edge: short flames that stay below the card text
        x = Math.random() * w; y = h + 2 * u;
        vx = (Math.random() - 0.5) * 4 * u; vy = -(16 + Math.random() * 18) * u; life = 0.3 + Math.random() * 0.35; size = (8 + Math.random() * 10) * u;
      } else {
        // a few small flickers along the top
        x = Math.random() * w; y = Math.random() * 2 * u;
        vx = (Math.random() - 0.5) * 3 * u; vy = -(6 + Math.random() * 6) * u; life = 0.2 + Math.random() * 0.25; size = (4 + Math.random() * 5) * u;
      }
      parts.push({ x, y, vx, vy, age: 0, life, size, seed: Math.random() * 1000 });
    };

    let raf = 0, last = performance.now(), acc = 0, running = false, t = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      // A few particles per second per pixel of card width keeps density constant at every card size.
      const boost = shell?.classList.contains("is-breathing") ? 2 : 1;
      acc += dt * Math.max(320, w * 3.6) * boost;
      while (acc > 1) { spawn(); acc -= 1; }
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const u = w / 100;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { parts.splice(i, 1); continue; }
        // Turbulence: layered sines give the tongues a natural lick and sway.
        const sway = Math.sin(p.seed + t * 7 + p.y * 0.08) * 9 * u + Math.sin(p.seed * 2 + t * 13) * 4 * u;
        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;
        p.vy *= 1 + dt * 0.8; // accelerates as hot air rises
        const size = p.size * (k < 0.2 ? 0.6 + k * 2 : 1 - (k - 0.2) * 0.85);
        const alpha = (k < 0.1 ? k * 10 : 1 - k) * 0.85;
        const sprite = sprites[Math.min(STEPS - 1, Math.floor(k * STEPS))]!;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p.x - size / 2, p.y - size * 1.2, size, size * 2.2);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()));
    io.observe(canvas);
    return () => { stop(); io.disconnect(); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

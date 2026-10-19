import { useEffect, useRef } from "react";

interface Flame { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; phase: number }

/** Animated golden flames licking up around a pack. Colors come from the theme tokens. */
export function GoldenFlames({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(canvas);
    const light = css.getPropertyValue("--card-light").trim() || "white";
    const glow = css.getPropertyValue("--primary-glow").trim() || "gold";
    const gold = css.getPropertyValue("--primary").trim() || "orange";

    // One soft flame sprite, reused for every particle.
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const s = sprite.getContext("2d")!;
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, light);
    g.addColorStop(0.25, glow);
    g.addColorStop(0.6, gold);
    g.addColorStop(1, "transparent");
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // The pack occupies the middle of the canvas; flames are born on its outline.
    const pack = () => ({ l: w * 0.24, r: w * 0.76, t: h * 0.2, b: h * 0.93 });
    const flames: Flame[] = [];
    const spawn = () => {
      const p = pack();
      const side = Math.random();
      let x: number, y: number, vx: number;
      if (side < 0.38) { x = p.l + Math.random() * 6; y = p.t + Math.random() * (p.b - p.t); vx = -10 - Math.random() * 25; }
      else if (side < 0.76) { x = p.r - Math.random() * 6; y = p.t + Math.random() * (p.b - p.t); vx = 10 + Math.random() * 25; }
      else { x = p.l + Math.random() * (p.r - p.l); y = p.t + Math.random() * 6; vx = (Math.random() - 0.5) * 20; }
      const max = 0.55 + Math.random() * 0.7;
      flames.push({ x, y, vx, vy: -50 - Math.random() * 80, life: max, max, size: 10 + Math.random() * 18, phase: Math.random() * 6.28 });
    };

    let raf = 0, last = performance.now(), acc = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt * 170;
      while (acc > 1) { spawn(); acc -= 1; }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i];
        f.life -= dt;
        if (f.life <= 0) { flames.splice(i, 1); continue; }
        const k = f.life / f.max;
        f.phase += dt * 9;
        f.x += (f.vx + Math.sin(f.phase) * 22) * dt;
        f.y += f.vy * dt;
        f.vx *= 0.97;
        const size = f.size * (0.35 + k * 0.75);
        ctx.globalAlpha = Math.min(1, k * 1.4) * 0.85;
        ctx.drawImage(sprite, f.x - size / 2, f.y - size, size, size * 1.7);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}

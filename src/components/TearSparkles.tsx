import { useEffect, useRef } from "react";

interface Spark { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; spin: number; star: boolean }

/**
 * Soft white light that follows the tear on a pack (sparkles trailing the finger,
 * a lens flare at the tear point), then pours out of the opening once it is torn.
 * The canvas is 150% of the pack, centred on it.
 */
export function TearSparkles({ progress, torn, tearY, className }: { progress: number; torn: boolean; tearY: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ progress, torn });
  live.current = { progress, torn };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(canvas);
    const light = css.getPropertyValue("--card-light").trim() || "white";
    const tint = css.getPropertyValue("--pack-light").trim() || light;

    // Round glow sprite.
    const glow = document.createElement("canvas");
    glow.width = glow.height = 64;
    const gctx = glow.getContext("2d")!;
    const gg = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, light);
    gg.addColorStop(0.22, light);
    gg.addColorStop(0.5, tint);
    gg.addColorStop(1, "transparent");
    gctx.globalAlpha = 1;
    gctx.fillStyle = gg;
    gctx.fillRect(0, 0, 64, 64);

    // Four-point star sprite.
    const star = document.createElement("canvas");
    star.width = star.height = 64;
    const sctx = star.getContext("2d")!;
    sctx.globalCompositeOperation = "lighter";
    for (const horizontal of [true, false]) {
      const lg = horizontal ? sctx.createLinearGradient(0, 0, 64, 0) : sctx.createLinearGradient(0, 0, 0, 64);
      lg.addColorStop(0, "transparent");
      lg.addColorStop(0.5, light);
      lg.addColorStop(1, "transparent");
      sctx.fillStyle = lg;
      if (horizontal) sctx.fillRect(0, 30.5, 64, 3);
      else sctx.fillRect(30.5, 0, 3, 64);
    }
    sctx.drawImage(glow, 20, 20, 24, 24);

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

    const pack = () => ({ l: w / 6, t: h / 6, pw: w / 1.5, ph: h / 1.5 });
    const headAt = (p: number) => {
      const b = pack();
      return { x: b.l + (0.06 + 0.88 * p) * b.pw, y: b.t + (tearY / 100) * b.ph };
    };

    const sparks: Spark[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const trail = (x: number, y: number) => {
      const max = rnd(0.45, 1.1);
      sparks.push({ x: x + rnd(-4, 4), y: y + rnd(-3, 3), vx: rnd(-70, 25), vy: rnd(-70, 30), g: 110, life: max, max, size: rnd(5, 13), spin: rnd(0, 6.28), star: Math.random() < 0.45 });
    };
    const pour = () => {
      const b = pack();
      const max = rnd(0.7, 1.4);
      sparks.push({
        x: b.l + rnd(0.08, 0.92) * b.pw, y: b.t + (tearY / 100) * b.ph + rnd(-4, 4),
        vx: rnd(-50, 50), vy: rnd(-260, -70), g: -60, life: max, max, size: rnd(6, 18), spin: rnd(0, 6.28), star: Math.random() < 0.5,
      });
    };

    let raf = 0, last = performance.now(), lastP = 0, tornAt = 0, flare = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { progress: p, torn: isTorn } = live.current;
      const head = headAt(p);

      if (!isTorn) {
        const moved = Math.max(0, p - lastP);
        const count = Math.ceil(moved * 160) + (p > 0 && Math.random() < 0.4 ? 1 : 0);
        for (let i = 0; i < count; i++) trail(head.x, head.y);
        flare += ((p > 0 ? 1 : 0) - flare) * Math.min(1, dt * 10);
      } else {
        if (!tornAt) { tornAt = now; for (let i = 0; i < 140; i++) pour(); }
        if (now - tornAt < 900) for (let i = 0; i < 6; i++) pour();
        flare = Math.max(0, flare - dt * 3);
      }
      lastP = p;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Light pouring out of the opened pack.
      if (tornAt) {
        const t = (now - tornAt) / 1000;
        const b = pack();
        const cx = b.l + b.pw / 2, cy = b.t + (tearY / 100) * b.ph;
        const a = Math.min(1, t / 0.35);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 0.55 + t * 0.4);
        const r = b.pw * (0.55 + t * 1.3);
        const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        bloom.addColorStop(0, light);
        bloom.addColorStop(0.35, tint);
        bloom.addColorStop(1, "transparent");
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = bloom;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        if (!s) continue;
        s.life -= dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vy += s.g * dt;
        s.vx *= 0.96;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += dt * 4;
        const k = s.life / s.max;
        const twinkle = 0.6 + 0.4 * Math.sin(s.spin * 3);
        const size = s.size * (0.4 + k * 0.6) * (s.star ? 1.6 : 1);
        ctx.globalAlpha = Math.min(1, k * 2) * twinkle;
        if (s.star) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.spin * 0.3);
          ctx.drawImage(star, -size / 2, -size / 2, size, size);
          ctx.restore();
        } else {
          ctx.drawImage(glow, s.x - size / 2, s.y - size / 2, size, size);
        }
      }

      // Lens flare riding the tear point.
      if (flare > 0.01) {
        const pulse = 1 + Math.sin(now / 90) * 0.08;
        ctx.globalAlpha = flare * 0.9;
        ctx.drawImage(glow, head.x - 34 * pulse, head.y - 34 * pulse, 68 * pulse, 68 * pulse);
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(now / 900);
        ctx.globalAlpha = flare;
        ctx.drawImage(star, -38, -38, 76, 76);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = flare * 0.5;
        ctx.drawImage(star, -22, -22, 44, 44);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [tearY]);

  return <canvas ref={ref} className={className} aria-hidden />;
}

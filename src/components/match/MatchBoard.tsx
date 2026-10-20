import { useEffect, useMemo, useRef, useState } from "react";
import { frameAt, type Pt, type Timeline } from "@/lib/match-replay";
import { firstName } from "@/lib/manager";
import { sfx } from "@/lib/sfx";

const W = 105, H = 68;
const X = (x: number) => (x / 100) * W;
const Y = (y: number) => (y / 100) * H;

/**
 * The 11 v 11 board: pawns with first names, the ball and the pitch, animated from a replay timeline.
 * Playback runs on requestAnimationFrame; pawns ease towards their targets so passes and runs look fluid.
 */
export function MatchBoard({ timeline, playing, speed, seek, onTick, onEnd, homeLabel, awayLabel }: {
  timeline: Timeline;
  playing: boolean;
  speed: number;
  /** Jump to this time whenever the object changes. */
  seek: { t: number };
  onTick: (t: number) => void;
  onEnd: () => void;
  homeLabel: string;
  awayLabel: string;
}) {
  const tRef = useRef(seek.t);
  const shown = useRef<Record<string, Pt>>({});
  const [, force] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(8);
  const cb = useRef({ onTick, onEnd });
  cb.current = { onTick, onEnd };
  const lastSeg = useRef<unknown>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale((e?.contentRect.width ?? 800) / (W + 6)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Seeking snaps every pawn to its spot.
  useEffect(() => {
    tRef.current = seek.t;
    shown.current = { ...frameAt(timeline, seek.t).pawns };
    lastSeg.current = null;
    force((n) => n + 1);
    cb.current.onTick(seek.t);
  }, [seek, timeline]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    let lastTick = 0;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const t = Math.min(timeline.end, tRef.current + dt * speed);
      tRef.current = t;
      const f = frameAt(timeline, t);
      const k = reduce ? 1 : 1 - Math.exp(-dt * speed * 7);
      const next: Record<string, Pt> = {};
      for (const [id, target] of Object.entries(f.pawns)) {
        const cur = shown.current[id] ?? target;
        next[id] = { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k };
      }
      shown.current = next;
      if (f.seg !== lastSeg.current) {
        if (lastSeg.current && speed <= 2 && (f.seg.kind === "shot" || (f.seg.kind === "pass" && f.seg.lift > 0))) sfx.kick();
        lastSeg.current = f.seg;
      }
      force((n) => (n + 1) % 1_000_000);
      if (now - lastTick > 100 || t >= timeline.end) { lastTick = now; cb.current.onTick(t); }
      if (t >= timeline.end) { cb.current.onEnd(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, timeline]);

  const frame = frameAt(timeline, tRef.current);
  const ball = frame.ball;
  const font = Math.max(1.45, 9 / scale);
  const labels = useMemo(() => Object.fromEntries(timeline.pawns.map((p) => [p.id, firstName(p.name)])), [timeline]);

  return (
    <div ref={wrap} className="mm-board relative w-full overflow-hidden rounded-xl">
      <svg viewBox={`-3 -3 ${W + 6} ${H + 6}`} className="block h-auto w-full" role="img" aria-label={`Match ${homeLabel} contre ${awayLabel}`}>
        <rect x={-3} y={-3} width={W + 6} height={H + 6} className="mm-turf-edge" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={(i * W) / 10} y={0} width={W / 10} height={H} className={i % 2 ? "mm-turf-a" : "mm-turf-b"} />
        ))}
        <g className="mm-lines" fill="none">
          <rect x={0} y={0} width={W} height={H} />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
          <circle cx={W / 2} cy={H / 2} r={9.15} />
          <circle cx={W / 2} cy={H / 2} r={0.4} className="mm-spot" />
          <rect x={0} y={H / 2 - 20.16} width={16.5} height={40.32} />
          <rect x={W - 16.5} y={H / 2 - 20.16} width={16.5} height={40.32} />
          <rect x={0} y={H / 2 - 9.16} width={5.5} height={18.32} />
          <rect x={W - 5.5} y={H / 2 - 9.16} width={5.5} height={18.32} />
          <path d={`M16.5 ${H / 2 - 7.3} A9.15 9.15 0 0 1 16.5 ${H / 2 + 7.3}`} />
          <path d={`M${W - 16.5} ${H / 2 - 7.3} A9.15 9.15 0 0 0 ${W - 16.5} ${H / 2 + 7.3}`} />
          <circle cx={11} cy={H / 2} r={0.4} className="mm-spot" />
          <circle cx={W - 11} cy={H / 2} r={0.4} className="mm-spot" />
        </g>
        <rect x={-2} y={H / 2 - 3.66} width={2} height={7.32} className="mm-goal" />
        <rect x={W} y={H / 2 - 3.66} width={2} height={7.32} className="mm-goal" />

        {timeline.pawns.map((p) => {
          const pos = shown.current[p.id] ?? frame.pawns[p.id]!;
          const gk = p.line === "gk";
          return (
            <g key={p.id} transform={`translate(${X(pos.x)} ${Y(pos.y)})`} className={p.side === "home" ? "mm-pawn-home" : "mm-pawn-away"}>
              <ellipse cx={0.25} cy={1.35} rx={1.6} ry={0.55} className="mm-shadow" />
              <circle r={1.65} className={gk ? "mm-pawn mm-pawn-gk" : "mm-pawn"} />
              <circle r={0.7} className="mm-pawn-core" />
              <text y={-2.35} fontSize={font} textAnchor="middle" className="mm-name">{labels[p.id]}</text>
            </g>
          );
        })}

        <ellipse cx={X(ball.x) + ball.z * 0.15} cy={Y(ball.y) + 0.5} rx={0.75} ry={0.32} className="mm-shadow" />
        <circle cx={X(ball.x)} cy={Y(ball.y) - ball.z * 0.55} r={0.72 + ball.z * 0.04} className="mm-ball" />
      </svg>
    </div>
  );
}

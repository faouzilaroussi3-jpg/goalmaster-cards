import { useMemo } from "react";
import { firstName } from "@/lib/manager";
import { PITCH_L, PITCH_W, type Game } from "@/lib/live-match";
import type { Side } from "@/lib/match-replay";
import { PitchMarkings } from "@/components/match/Pitch";

/**
 * The steered match board: same pitch and pawns as the replay, drawn straight from the live game state.
 * The parent re-renders it every animation frame. My controlled pawn wears a pink ring and arrow.
 */
export function LiveBoard({ game, mySide, homeLabel, awayLabel }: { game: Game; mySide: Side | null; homeLabel: string; awayLabel: string }) {
  const labels = useMemo(() => game.players.map((p) => firstName(p.name)), [game]);
  const b = game.ball;
  return (
    <svg viewBox={`-3 -3 ${PITCH_L + 6} ${PITCH_W + 6}`} className="mm-board block h-auto w-full rounded-xl" role="img" aria-label={`Match ${homeLabel} contre ${awayLabel}`}>
      <PitchMarkings />
      {game.players.map((p) => {
        const mine = mySide === p.side && game.ctrl[p.side] === p.id;
        const theirs = !mine && mySide !== p.side && game.human[p.side] && game.ctrl[p.side] === p.id;
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} className={p.side === "home" ? "mm-pawn-home" : "mm-pawn-away"}>
            <ellipse cx={0.25} cy={1.35} rx={1.6} ry={0.55} className="mm-shadow" />
            {mine && <circle r={2.5} className="lm-ctrl" />}
            {theirs && <circle r={2.3} className="lm-ctrl-opp" />}
            <circle r={1.55} className={p.gk ? "mm-pawn mm-pawn-gk" : "mm-pawn"} />
            <circle r={0.65} className="mm-pawn-core" />
            <line x1={0} y1={0} x2={p.fx * 1.5} y2={p.fy * 1.5} className="lm-facing" />
            <text y={-2.4} fontSize={1.7} textAnchor="middle" className="mm-name">{labels[p.id]}</text>
            {mine && <path d="M-0.9 -5.3 L0.9 -5.3 L0 -4.2 Z" className="lm-arrow" />}
          </g>
        );
      })}
      <ellipse cx={b.x + b.z * 0.15} cy={b.y + 0.5} rx={0.7} ry={0.3} className="mm-shadow" />
      <circle cx={b.x} cy={b.y - b.z * 0.55} r={0.68 + b.z * 0.05} className="mm-ball" />
    </svg>
  );
}

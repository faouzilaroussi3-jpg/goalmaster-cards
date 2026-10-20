// Presentation only: turns the server's half events (who shot, what happened, roughly when) into a ball path and
// pawn positions on the board. The outcome never changes here: every goal in the replay is a goal from the server.
import { FORMATIONS, HALF_SECONDS, type FormationKey, type Line } from "@/lib/manager";

export type Side = "home" | "away";
export interface Pt { x: number; y: number }
export type EventKind = "goal" | "save" | "miss" | "tackle";
export interface MatchEvent {
  t: number; side: Side; kind: EventKind; shooter: number;
  assist: number | null; defender: number | null; keeper: number | null;
}
export interface TeamInput { formation: FormationKey; players: { slot: number; name: string; line?: Line }[] }
export interface Pawn { id: string; side: Side; slot: number; line: Line; base: Pt; name: string }
export type SegKind = "pass" | "dribble" | "shot" | "hold" | "dead";
export interface Seg {
  t0: number; t1: number; from: Pt; to: Pt; kind: SegKind;
  /** Team in possession (pushes up), null for dead-ball moments where both teams stand in shape. */
  side: Side | null; holder: string | null; receiver: string | null; lift: number;
}
export interface FeedItem {
  t: number; side: Side; kind: EventKind; shooter: number; assist: number | null;
  keeper: number | null; defender: number | null; home: number; away: number;
}
export interface Timeline { segs: Seg[]; feed: FeedItem[]; end: number; pawns: Pawn[] }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const other = (s: Side): Side => (s === "home" ? "away" : "home");
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Pt, b: Pt, p: number): Pt => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
/** Home attacks towards x = 100; away is the same shape rotated half a turn. */
export const flip = (side: Side, p: Pt): Pt => (side === "home" ? p : { x: 100 - p.x, y: 100 - p.y });

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePawns(team: TeamInput, side: Side): Pawn[] {
  const slots = FORMATIONS[team.formation].slots;
  return team.players.map((p) => {
    const sl = slots[p.slot] ?? slots[0]!;
    return { id: `${side}-${p.slot}`, side, slot: p.slot, line: p.line ?? sl.line, base: { x: sl.x, y: sl.y }, name: p.name };
  });
}

const MIN_X: Record<Line, number> = { gk: 2, def: 8, mid: 14, att: 22 };

/** Where a pawn stands given the ball and who has it: the block slides with the ball and pushes up in possession. */
export function shapePos(p: Pawn, possession: Side | null, ball: Pt): Pt {
  const b = flip(p.side, ball);
  if (p.line === "gk") return flip(p.side, { x: 4 + clamp((b.x - 30) * 0.05, 0, 6), y: 50 + (b.y - 50) * 0.25 });
  const push = possession === p.side ? 16 : possession ? -3 : 0;
  const follow = possession ? (b.x - 50) * 0.25 : 0;
  return flip(p.side, {
    x: clamp(p.base.x + push + follow, MIN_X[p.line], 92),
    y: clamp(p.base.y + (b.y - p.base.y) * 0.18, 3, 97),
  });
}

export function buildTimeline(home: TeamInput, away: TeamInput, events: MatchEvent[], seed: string, kickoff: Side = "home"): Timeline {
  const rng = mulberry32(hash(seed));
  const R = (a: number, b: number) => a + rng() * (b - a);
  const pawns = [...makePawns(home, "home"), ...makePawns(away, "away")];
  const team = (side: Side) => pawns.filter((p) => p.side === side);
  const find = (side: Side, slot: number | null | undefined) =>
    (slot == null ? undefined : pawns.find((p) => p.side === side && p.slot === slot));
  const keeperOf = (side: Side) => team(side).find((p) => p.line === "gk") ?? team(side)[0]!;
  const segs: Seg[] = [];
  const feed: FeedItem[] = [];
  const score = { home: 0, away: 0 };
  let c = 0;
  let ball: Pt = { x: 50, y: 50 };
  let holder: Pawn = team(kickoff)[0]!;

  const push = (dur: number, to: Pt, kind: SegKind, side: Side | null, holderId: string | null, receiver: string | null, lift = 0) => {
    segs.push({ t0: c, t1: c + dur, from: ball, to, kind, side, holder: holderId, receiver, lift });
    c += dur;
    ball = to;
  };
  const weighted = <T,>(items: T[], w: (x: T) => number): T => {
    const ws = items.map(w);
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) { r -= ws[i]!; if (r <= 0) return items[i]!; }
    return items[items.length - 1]!;
  };
  const striker = (side: Side) => {
    const out = team(side).filter((p) => p.line !== "gk");
    return [...out].sort((a, b) => b.base.x - a.base.x || Math.abs(a.base.y - 50) - Math.abs(b.base.y - 50))[0] ?? team(side)[0]!;
  };
  const LINE_W: Record<Line, number> = { gk: 0.15, def: 1, mid: 2.2, att: 1.6 };
  const teammate = (from: Pawn) => {
    const mates = team(from.side).filter((p) => p.id !== from.id && p.line !== "gk");
    return weighted(mates, (p) => LINE_W[p.line] / (1 + dist(shapePos(p, from.side, ball), ball) / 22));
  };
  const presser = (side: Side) => {
    const opp = team(other(side)).filter((p) => p.line !== "gk");
    const near = [...opp].sort((a, b) => dist(shapePos(a, side, ball), ball) - dist(shapePos(b, side, ball), ball)).slice(0, 3);
    return near[Math.floor(rng() * near.length)] ?? opp[0]!;
  };
  const clampPitch = (p: Pt): Pt => ({ x: clamp(p.x, 3, 97), y: clamp(p.y, 4, 96) });

  const dribble = (dur: number, toward?: Pt) => {
    const dir = holder.side === "home" ? 1 : -1;
    const to = toward ? clampPitch(lerp(ball, toward, 0.5)) : clampPitch({ x: ball.x + dir * R(1, 5), y: ball.y + R(-4, 4) });
    push(dur, to, "dribble", holder.side, holder.id, null);
  };
  const passTo = (r: Pawn, target?: Pt) => {
    const dir = r.side === "home" ? 1 : -1;
    const shape = shapePos(r, r.side, ball);
    const to = clampPitch(target ?? { x: shape.x + dir * R(0, 4), y: shape.y + R(-3, 3) });
    const d = dist(ball, to);
    push(clamp(d / 38, 0.45, 1.5), to, "pass", holder.side, holder.id, r.id, d > 28 ? Math.min(6, d * 0.12) : 0);
    holder = r;
  };
  const kickoffAt = (side: Side) => {
    ball = { x: 50, y: 50 };
    holder = striker(side);
    push(1.1, ball, "dead", null, holder.id, null);
  };
  const ambient = (until: number) => {
    while (c < until - 0.35) {
      dribble(Math.min(R(0.45, 1), Math.max(0.3, until - c)));
      if (c >= until - 0.35) break;
      passTo(rng() < 0.2 ? presser(holder.side) : teammate(holder));
    }
  };

  kickoffAt(kickoff);
  for (const e of events) {
    const at = Math.max(e.t, c + 2.6);
    ambient(at - 3.2);
    const opp = other(e.side);
    const shooter = find(e.side, e.shooter) ?? striker(e.side);
    const assist = find(e.side, e.assist);
    const dir = e.side === "home" ? 1 : -1;
    const gx = e.side === "home" ? 100 : 0;
    if (holder.side !== e.side) {
      const winners = team(e.side).filter((p) => p.line === "mid" || p.line === "def");
      passTo(winners.length ? winners[Math.floor(rng() * winners.length)]! : teammate(shooter));
    }
    if (assist && assist.id !== shooter.id && holder.id !== assist.id) { passTo(assist); dribble(0.35); }
    const spot = flip(e.side, { x: R(74, 86), y: R(28, 72) });
    if (holder.id !== shooter.id) passTo(shooter, spot);
    else push(0.8, spot, "dribble", e.side, shooter.id, null);
    dribble(0.35, { x: gx, y: 50 });
    const item = (): FeedItem => ({ t: c, side: e.side, kind: e.kind, shooter: shooter.slot, assist: assist?.slot ?? null,
      keeper: e.keeper, defender: e.defender, home: score.home, away: score.away });

    if (e.kind === "tackle") {
      const d = find(opp, e.defender) ?? presser(e.side);
      push(0.35, clampPitch({ x: ball.x - dir * 1.5, y: ball.y + R(-2, 2) }), "pass", e.side, shooter.id, d.id);
      holder = d;
      feed.push(item());
      dribble(0.5);
      passTo(teammate(d));
    } else if (e.kind === "goal") {
      push(0.5, { x: gx + dir * 1.8, y: R(46.5, 53.5) }, "shot", e.side, shooter.id, null);
      score[e.side] += 1;
      feed.push(item());
      push(2.8, ball, "dead", e.side, null, null);
      kickoffAt(opp);
    } else if (e.kind === "save") {
      const k = find(opp, e.keeper) ?? keeperOf(opp);
      push(0.5, { x: gx - dir * 2.2, y: R(43, 57) }, "shot", e.side, shooter.id, k.id);
      feed.push(item());
      holder = k;
      push(1.1, ball, "hold", opp, k.id, null);
      passTo(teammate(k));
    } else {
      push(0.55, { x: gx + dir * 3, y: rng() < 0.5 ? R(30, 41) : R(59, 70) }, "shot", e.side, shooter.id, null);
      feed.push(item());
      push(1.6, ball, "dead", null, null, null);
      const k = keeperOf(opp);
      holder = k;
      ball = flip(opp, { x: 6, y: 50 });
      push(0.8, ball, "dead", opp, k.id, null);
      passTo(teammate(k));
    }
  }
  ambient(HALF_SECONDS);
  if (c < HALF_SECONDS) push(HALF_SECONDS - c, ball, "hold", holder.side, holder.id, null);
  return { segs, feed, end: c, pawns };
}

function segAt(segs: Seg[], t: number) {
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid]!.t0 <= t) lo = mid; else hi = mid - 1;
  }
  return segs[lo]!;
}

export interface Frame { ball: Pt & { z: number }; pawns: Record<string, Pt>; seg: Seg }

/** Ball and pawn targets at time t (the board eases pawns towards them). */
export function frameAt(tl: Timeline, t: number): Frame {
  const seg = segAt(tl.segs, clamp(t, 0, tl.end));
  const span = Math.max(0.001, seg.t1 - seg.t0);
  const p = clamp((t - seg.t0) / span, 0, 1);
  const eased = seg.kind === "pass" ? 1 - (1 - p) * (1 - p) : p;
  const b = lerp(seg.from, seg.to, eased);
  const ball = { ...b, z: seg.lift * Math.sin(Math.PI * p) };
  const poss = seg.side;
  const pawns: Record<string, Pt> = {};
  let press: Pawn | null = null;
  if (poss && (seg.kind === "pass" || seg.kind === "dribble")) {
    let best = Infinity;
    for (const pw of tl.pawns) {
      if (pw.side === poss || pw.line === "gk") continue;
      const d = dist(shapePos(pw, poss, ball), ball);
      if (d < best) { best = d; press = pw; }
    }
  }
  for (const pw of tl.pawns) {
    const shape = shapePos(pw, poss, ball);
    if (pw.id === seg.holder && (seg.kind === "dribble" || seg.kind === "hold" || seg.kind === "dead")) {
      const dir = pw.side === "home" ? 1 : -1;
      pawns[pw.id] = { x: ball.x - dir * 0.9, y: ball.y };
    } else if (pw.id === seg.holder) {
      pawns[pw.id] = seg.from;
    } else if (pw.id === seg.receiver) {
      const q = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      pawns[pw.id] = lerp(shape, seg.to, q);
    } else if (press && pw.id === press.id) {
      pawns[pw.id] = lerp(shape, ball, 0.55);
    } else {
      pawns[pw.id] = shape;
    }
  }
  return { ball, pawns, seg };
}

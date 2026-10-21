// Steered 11 v 11: a small fixed-step football simulation that the players drive themselves (keyboard, touch, gamepad).
// Runs in the browser: alone against the computer, or hosted by the home player for a live match with a friend.
// Metres everywhere: x = length (0..105, home attacks towards x = 105), y = width (0..68, 0 = top touchline on screen).
import { FORMATIONS, HALF_SECONDS, matchPayout, type Line, type RatedTeam } from "@/lib/manager";
import { shapePos, type Pawn, type Side } from "@/lib/match-replay";

export const PITCH_L = 105;
export const PITCH_W = 68;
export const GOAL_HALF = 3.66;
export const GOAL_H = 2.44;
export const STEP = 1 / 60;
export const COUNTDOWN = 3;
/** Running over the ball carrier wins the ball. */
export const CONTACT_STEAL = 0.9;
/** Holding the shoot button very close to the carrier wins the ball too. */
export const TACKLE_RANGE = 1.9;
/** Bodies never overlap closer than this (smaller than CONTACT_STEAL so running over the carrier is possible). */
const SEPARATION = 0.7;

export type BotLevel = "commune" | "legendaire" | "royal";
export interface BotParams {
  label: string; hint: string; react: number; speed: number; passErr: number; shotErr: number;
  steal: number; pressers: number; range: number; keeper: number;
}
export const BOT_LEVELS: Record<BotLevel, BotParams> = {
  commune: { label: "Commune", hint: "Pour débuter : l'ordi réfléchit lentement et rate souvent.", react: 0.75, speed: 0.86, passErr: 2.2, shotErr: 1.8, steal: 0.45, pressers: 1, range: 15, keeper: -0.12 },
  legendaire: { label: "Légendaire", hint: "Un vrai match : l'ordi presse, combine et cadre ses frappes.", react: 0.42, speed: 0.97, passErr: 1.1, shotErr: 1, steal: 0.8, pressers: 1, range: 18, keeper: 0 },
  royal: { label: "Royal", hint: "Pour les meilleurs : pressing à deux, passes précises, gardien en feu.", react: 0.22, speed: 1.06, passErr: 0.5, shotErr: 0.6, steal: 1.3, pressers: 2, range: 21, keeper: 0.08 },
};
export const BOT_LEVEL_KEYS = Object.keys(BOT_LEVELS) as BotLevel[];
/** Decisions of the human side's keeper (the only player a human never steers). */
const HUMAN_KEEPER = BOT_LEVELS.legendaire;

/** One pad reading. Buttons are counters so a press is never lost between two network packets. */
export interface PadInput {
  mx: number; my: number; sprint: boolean; shootHeld: boolean;
  pass: number; through: number; cross: number; swap: number; shot: number; shotPress: number; power: number;
}
export const idlePad = (): PadInput => ({ mx: 0, my: 0, sprint: false, shootHeld: false, pass: 0, through: 0, cross: 0, swap: 0, shot: 0, shotPress: 0, power: 0 });

/** Ball won when running over the carrier, or very close while holding shoot. */
export function canSteal(dist: number, holdingShoot: boolean) {
  return dist <= CONTACT_STEAL || (holdingShoot && dist <= TACKLE_RANGE);
}
/** Coins for a finished steered match: winner takes the win payout, loser the loss payout, a draw pays both alike. */
export const liveMatchPayout = (mine: number, theirs: number) => matchPayout(mine > theirs ? 1 : mine < theirs ? 0 : 0.5);
/** Power of a shot from how long the button was held. */
export const shotPower = (ms: number) => Math.min(1, Math.max(0.15, ms / 750));

export interface GPlayer {
  id: number; side: Side; slot: number; line: Line; name: string; pawn: Pawn; k: number; gk: boolean;
  x: number; y: number; vx: number; vy: number; dvx: number; dvy: number; fx: number; fy: number;
  runX: number; runY: number; runUntil: number; lock: number;
}
export interface GBall { x: number; y: number; z: number; vx: number; vy: number; vz: number; owner: number; last: number; shot: Side | null; tried: boolean }
export type Phase = "ready" | "countdown" | "play" | "goal" | "halftime" | "ended";
export type GameEventKind = "whistle" | "kick" | "goal" | "save" | "steal" | "post" | "out";
export interface GameEvent { id: number; kind: GameEventKind; side: Side; player: number; half: 1 | 2; t: number; n?: number | undefined }
export interface Game {
  clock: number; t: number; half: 1 | 2; phase: Phase; phaseT: number; kickoff: Side;
  score: Record<Side, number>; players: GPlayer[]; ball: GBall; ctrl: Record<Side, number>;
  human: Record<Side, boolean>; level: BotParams; rng: () => number;
  seen: Record<Side, PadInput>; charge: Record<Side, boolean>; events: GameEvent[]; nextEvent: number;
  aiTimer: Record<Side, number>; protectUntil: number; holdSince: number; autoT: number;
}

const SIDES: Side[] = ["home", "away"];
const other = (s: Side): Side => (s === "home" ? "away" : "home");
const dirOf = (s: Side) => (s === "home" ? 1 : -1);
/** x of the goal a side attacks. */
const goalX = (s: Side) => (s === "home" ? PITCH_L : 0);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hyp = Math.hypot;
const toM = (p: { x: number; y: number }) => ({ x: (p.x * PITCH_L) / 100, y: (p.y * PITCH_W) / 100 });
const toPct = (x: number, y: number) => ({ x: (x * 100) / PITCH_L, y: (y * 100) / PITCH_W });

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => (r() + r() + r() - 1.5) * 1.15;

export function createGame(home: RatedTeam, away: RatedTeam, opts: { human: Record<Side, boolean>; level: BotLevel; seed: string }): Game {
  const players: GPlayer[] = [];
  for (const [side, team] of [["home", home], ["away", away]] as const) {
    const slots = FORMATIONS[team.formation]?.slots ?? FORMATIONS["4-3-3"].slots;
    for (const p of team.players) {
      const sl = slots[p.slot] ?? slots[0]!;
      const id = players.length;
      const line = p.line ?? sl.line;
      players.push({
        id, side, slot: p.slot, line, name: p.name, gk: line === "gk",
        pawn: { id: `${side}-${p.slot}`, side, slot: p.slot, line, base: { x: sl.x, y: sl.y }, name: p.name },
        k: clamp(((p.eff ?? p.rating) - 50) / 50, 0, 1),
        x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0, fx: dirOf(side), fy: 0, runX: 0, runY: 0, runUntil: 0, lock: 0,
      });
    }
  }
  const g: Game = {
    clock: 0, t: 0, half: 1, phase: "ready", phaseT: 0, kickoff: "home", score: { home: 0, away: 0 }, players,
    ball: { x: PITCH_L / 2, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, shot: null, tried: false },
    ctrl: { home: 0, away: 0 }, human: opts.human, level: BOT_LEVELS[opts.level] ?? BOT_LEVELS.legendaire, rng: rngFrom(opts.seed),
    seen: { home: idlePad(), away: idlePad() }, charge: { home: false, away: false }, events: [], nextEvent: 0,
    aiTimer: { home: 0, away: 0 }, protectUntil: 0, holdSince: 0, autoT: 0,
  };
  placeKickoff(g, "home");
  return g;
}

export function startGame(g: Game) {
  if (g.phase !== "ready") return;
  g.phase = "countdown";
  g.phaseT = COUNTDOWN;
}

const team = (g: Game, s: Side) => g.players.filter((p) => p.side === s);
const keeperOf = (g: Game, s: Side) => team(g, s).find((p) => p.gk) ?? team(g, s)[0]!;
const isCtrl = (g: Game, p: GPlayer) => g.human[p.side] && g.ctrl[p.side] === p.id;

function emit(g: Game, kind: GameEventKind, p: GPlayer | null, side: Side, n?: number) {
  g.events.push({ id: ++g.nextEvent, kind, side, player: p?.id ?? -1, half: g.half, t: g.t, n });
  if (g.events.length > 12) g.events.splice(0, g.events.length - 12);
}

function shape(g: Game, p: GPlayer, poss: Side | null) {
  const s = toM(shapePos(p.pawn, poss, toPct(g.ball.x, g.ball.y)));
  // Attackers in possession push higher than the replay shape so there is always someone to find.
  if (p.line === "gk") return s;
  if (poss === p.side) s.x = clamp(s.x + dirOf(p.side) * (p.line === "att" ? 10 : p.line === "mid" ? 6 : 3), 3, PITCH_L - 3);
  else if (poss) s.x = clamp(s.x - dirOf(p.side) * (p.line === "def" ? 4 : 6), 3, PITCH_L - 3);
  return s;
}

function placeKickoff(g: Game, side: Side) {
  g.kickoff = side;
  const b = g.ball;
  Object.assign(b, { x: PITCH_L / 2, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, shot: null, tried: false });
  for (const p of g.players) {
    const s = toM(shapePos(p.pawn, null, { x: 50, y: 50 }));
    if (p.side === "home") s.x = Math.min(s.x, side === "home" ? 51 : 42);
    else s.x = Math.max(s.x, side === "away" ? 54 : 63);
    Object.assign(p, { x: s.x, y: s.y, vx: 0, vy: 0, dvx: 0, dvy: 0, fx: dirOf(p.side), fy: 0, runUntil: 0, lock: 0 });
  }
  const kickers = team(g, side).filter((p) => !p.gk).sort((a, b2) => b2.pawn.base.x - a.pawn.base.x || Math.abs(a.pawn.base.y - 50) - Math.abs(b2.pawn.base.y - 50));
  const striker = kickers[0]!;
  striker.x = PITCH_L / 2 - dirOf(side) * 0.8;
  striker.y = PITCH_W / 2;
  b.owner = striker.id;
  b.last = striker.id;
  g.ctrl[side] = striker.id;
  g.ctrl[other(side)] = nearestTo(g, other(side), b.x, b.y, -1)?.id ?? g.ctrl[other(side)];
  g.protectUntil = g.clock + 1;
  g.holdSince = g.clock;
  g.aiTimer[side] = 0.6;
}

function nearestTo(g: Game, s: Side, x: number, y: number, exclude: number) {
  let best: GPlayer | null = null; let bd = Infinity;
  for (const p of g.players) {
    if (p.side !== s || p.gk || p.id === exclude) continue;
    const d = hyp(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function speedOf(g: Game, p: GPlayer, sprint: boolean) {
  const base = (6.4 + 1.8 * p.k) * (g.human[p.side] ? 1 : g.level.speed);
  return base * (sprint ? 1.32 : 1) * (g.ball.owner === p.id ? 0.9 : 1);
}

function setDesired(p: GPlayer, tx: number, ty: number, max: number) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < 0.25) { p.dvx = 0; p.dvy = 0; return; }
  const sp = Math.min(max, d * 2.4);
  p.dvx = (dx / d) * sp;
  p.dvy = (dy / d) * sp;
}

// ---------- Kicks ----------

function kick(g: Game, p: GPlayer, tx: number, ty: number, speed: number, vz: number, shot: boolean) {
  const b = g.ball;
  b.owner = -1;
  b.last = p.id;
  const dx = tx - b.x, dy = ty - b.y, d = hyp(dx, dy) || 1;
  b.vx = (dx / d) * speed;
  b.vy = (dy / d) * speed;
  b.vz = vz;
  b.z = Math.max(b.z, 0.02);
  b.shot = shot ? p.side : null;
  b.tried = false;
  p.lock = 0.3;
  emit(g, "kick", p, p.side, vz > 4 ? 1 : 0);
}

const errMul = (g: Game, s: Side, kind: "pass" | "shot") => (g.human[s] ? 1 : kind === "pass" ? g.level.passErr : g.level.shotErr);

function shootAt(g: Game, p: GPlayer, power: number, aimY: number) {
  const gx = goalX(p.side);
  const dist = hyp(gx - p.x, PITCH_W / 2 - p.y);
  const err = (0.35 + (1 - p.k) * 1.6 + power * 0.8 + dist / 30 + Math.max(0, dist - 22) / 12) * errMul(g, p.side, "shot");
  const ty = aimY + gauss(g.rng) * err;
  const speed = 16 + power * 15 + p.k * 3;
  const vz = 0.8 + power * 2.2 + Math.max(0, power - 0.88) * 45 + Math.abs(gauss(g.rng)) * 0.5;
  kick(g, p, gx + dirOf(p.side) * 2, ty, speed, vz, true);
}

function humanShoot(g: Game, p: GPlayer, pad: PadInput) {
  const aim = Math.abs(pad.my) > 0.25 ? PITCH_W / 2 + Math.sign(pad.my) * 2.7 * Math.min(1, Math.abs(pad.my) / 0.8) : PITCH_W / 2 + (g.rng() - 0.5) * 2;
  shootAt(g, p, clamp(pad.power, 0.15, 1), aim);
}

function laneOpen(g: Game, from: GPlayer, tx: number, ty: number) {
  let best = 8;
  const dx = tx - from.x, dy = ty - from.y, L = hyp(dx, dy) || 1;
  for (const q of g.players) {
    if (q.side === from.side) continue;
    const u = clamp(((q.x - from.x) * dx + (q.y - from.y) * dy) / (L * L), 0, 1);
    best = Math.min(best, hyp(from.x + dx * u - q.x, from.y + dy * u - q.y));
  }
  return best;
}

function passTo(g: Game, p: GPlayer, q: GPlayer, through: boolean, lateral = 0) {
  const dir = dirOf(p.side);
  let tx: number, ty: number;
  if (through) {
    const space = 9 + p.k * 3;
    tx = q.x + dir * space * 0.85;
    ty = q.y + lateral * space * 0.5;
  } else {
    const d0 = hyp(q.x - p.x, q.y - p.y);
    const lead = 0.3 + d0 / 45;
    tx = q.x + q.vx * lead;
    ty = q.y + q.vy * lead;
  }
  const d = hyp(tx - p.x, ty - p.y);
  const err = (0.25 + (1 - p.k) * 1.1 + d / 45) * errMul(g, p.side, "pass");
  tx = clamp(tx + gauss(g.rng) * err * 0.5, 1.5, PITCH_L - 1.5);
  ty = clamp(ty + gauss(g.rng) * err * 0.5, 1.5, PITCH_W - 1.5);
  const dist = hyp(tx - p.x, ty - p.y);
  const speed = clamp(8 + dist * 0.68, 11, 28);
  kick(g, p, tx, ty, speed, 0, false);
  // The receiver of a ground pass comes to meet the ball; a through ball is run onto.
  const back = through ? 0 : Math.min(2, dist * 0.1);
  q.runX = tx - ((tx - p.x) / (dist || 1)) * back; q.runY = ty - ((ty - p.y) / (dist || 1)) * back;
  q.runUntil = g.clock + dist / speed + (through ? 1.6 : 0.8);
  if (g.human[p.side] && !q.gk) g.ctrl[p.side] = q.id;
}

function pickReceiver(g: Game, p: GPlayer, dx: number, dy: number, through: boolean) {
  let best: GPlayer | null = null; let bs = -Infinity;
  for (const q of team(g, p.side)) {
    if (q.id === p.id) continue;
    const vx = q.x - p.x, vy = q.y - p.y, d = hyp(vx, vy);
    if (d < 2.5 || d > 55) continue;
    const cos = (vx * dx + vy * dy) / d;
    const ahead = (q.x - p.x) * dirOf(p.side);
    const score = through
      ? cos * 2.5 + ahead * 0.03 - (q.gk ? 6 : 0) - (q.line === "def" ? 0.4 : 0)
      : cos * 2.6 - d / 35 - (q.gk ? (cos > 0.75 ? 0.6 : 4) : 0) + laneOpen(g, p, q.x, q.y) * 0.12;
    if (score > bs) { bs = score; best = q; }
  }
  return best;
}

function cross(g: Game, p: GPlayer, aimY: number) {
  const dir = dirOf(p.side), gx = goalX(p.side), spotX = gx - dir * 8.5;
  let q: GPlayer | null = null; let qd = Infinity;
  for (const m of team(g, p.side)) {
    if (m.id === p.id || m.gk || Math.abs(m.x - gx) > 26) continue;
    const d = hyp(m.x - spotX, m.y - PITCH_W / 2);
    if (d < qd) { qd = d; q = m; }
  }
  let tx = q ? q.x * 0.55 + spotX * 0.45 : spotX;
  let ty = q ? q.y * 0.55 + (PITCH_W / 2) * 0.45 : PITCH_W / 2 + aimY * 5;
  const err = (0.6 + (1 - p.k) * 2.2) * errMul(g, p.side, "pass");
  tx += gauss(g.rng) * err; ty += gauss(g.rng) * err;
  const dist = hyp(tx - p.x, ty - p.y);
  const hs = clamp(10 + dist * 0.42, 15, 25);
  const T = (dist / hs) * 1.05;
  kick(g, p, tx, ty, hs, Math.min(13, (9.81 * T) / 2), false);
  if (q) {
    q.runX = tx; q.runY = ty; q.runUntil = g.clock + T + 0.6;
    if (g.human[p.side]) g.ctrl[p.side] = q.id;
  }
}

// ---------- Possession ----------

function gain(g: Game, p: GPlayer, steal: boolean) {
  const b = g.ball;
  const prev = b.last >= 0 ? g.players[b.last]!.side : null;
  Object.assign(b, { owner: p.id, last: p.id, shot: null, z: 0, vz: 0 });
  g.protectUntil = g.clock + (steal ? 0.6 : 0.3);
  g.holdSince = g.clock;
  g.aiTimer[p.side] = (g.human[p.side] ? HUMAN_KEEPER : g.level).react * (0.5 + g.rng() * 0.5);
  p.runUntil = 0;
  if (g.human[p.side] && !p.gk) g.ctrl[p.side] = p.id;
  if (steal || (prev && prev !== p.side)) emit(g, "steal", p, p.side);
}

function restart(g: Game, p: GPlayer, x: number, y: number) {
  Object.assign(p, { x, y, vx: 0, vy: 0, dvx: 0, dvy: 0 });
  const fx = PITCH_L / 2 - x, fy = PITCH_W / 2 - y, f = hyp(fx, fy) || 1;
  p.fx = fx / f; p.fy = fy / f;
  Object.assign(g.ball, { x: x + p.fx * 0.7, y: y + p.fy * 0.7, z: 0, vx: 0, vy: 0, vz: 0, owner: p.id, last: p.id, shot: null, tried: false });
  g.protectUntil = g.clock + 1.2;
  g.holdSince = g.clock;
  g.aiTimer[p.side] = 0.7;
  if (g.human[p.side] && !p.gk) g.ctrl[p.side] = p.id;
  emit(g, "out", p, p.side);
}

// ---------- Step ----------

export type Pads = { [K in Side]?: PadInput | undefined };

export function stepGame(g: Game, pads: Pads, dt = STEP) {
  g.clock += dt;
  for (const p of g.players) p.lock = Math.max(0, p.lock - dt);
  switch (g.phase) {
    case "ready":
    case "ended":
      return;
    case "countdown":
      g.phaseT -= dt;
      if (g.phaseT <= 0) { g.phase = "play"; emit(g, "whistle", null, g.kickoff, 1); }
      return;
    case "halftime":
      g.phaseT -= dt;
      if (g.phaseT <= 0) { g.half = 2; g.t = 0; placeKickoff(g, "away"); g.phase = "countdown"; g.phaseT = 2; }
      return;
    case "goal":
      g.phaseT -= dt;
      g.t += dt;
      offBall(g, dt, true);
      integrate(g, dt);
      ballFree(g, dt);
      g.ball.x = clamp(g.ball.x, -2, PITCH_L + 2);
      if (g.phaseT <= 0) { placeKickoff(g, g.kickoff); g.phase = "countdown"; g.phaseT = 1.2; }
      endOfHalf(g);
      return;
  }
  g.t += dt;
  for (const s of SIDES) if (g.human[s]) humanSide(g, s, pads[s], dt);
  offBall(g, dt, false);
  integrate(g, dt);
  const b = g.ball;
  if (b.owner >= 0) {
    const o = g.players[b.owner]!;
    b.x = o.x + o.fx * 0.7; b.y = o.y + o.fy * 0.7; b.z = 0; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
  } else {
    ballFree(g, dt);
    keeperSave(g);
    rules(g);
  }
  if (g.phase === "play") contest(g, pads, dt);
  endOfHalf(g);
}

function endOfHalf(g: Game) {
  if (g.t < HALF_SECONDS || (g.phase !== "play" && g.phase !== "goal")) return;
  if (g.half === 1) { g.phase = "halftime"; g.phaseT = 4; emit(g, "whistle", null, "home", 2); }
  else { g.phase = "ended"; emit(g, "whistle", null, "home", 3); }
}

function humanSide(g: Game, s: Side, input: PadInput | undefined, dt: number) {
  const seen = g.seen[s];
  const pad = input ?? { ...seen, mx: 0, my: 0, sprint: false, shootHeld: false };
  const fired = (k: "pass" | "through" | "cross" | "swap" | "shot" | "shotPress") => pad[k] > seen[k];
  let c = g.players[g.ctrl[s]]!;
  const b = g.ball;
  if (fired("swap")) {
    const n = nearestTo(g, s, b.x, b.y, c.id);
    if (n) c = n;
    g.ctrl[s] = c.id;
  }
  // Auto-switch to the nearest team-mate when the ball is loose or the opponent has it.
  g.autoT -= dt;
  const mine = b.owner >= 0 && g.players[b.owner]!.side === s;
  if (!mine && g.autoT <= 0 && !fired("swap")) {
    g.autoT = 0.25;
    const n = nearestTo(g, s, b.x, b.y, -1);
    if (n && n.id !== c.id && hyp(c.x - b.x, c.y - b.y) - hyp(n.x - b.x, n.y - b.y) > (b.owner < 0 ? 2.5 : 5)) { c = n; g.ctrl[s] = n.id; }
  }
  if (fired("shotPress")) g.charge[s] = b.owner === c.id;
  if (b.owner === c.id) {
    const m = hyp(pad.mx, pad.my);
    const dx = m > 0.2 ? pad.mx / m : c.fx, dy = m > 0.2 ? pad.my / m : c.fy;
    if (fired("shot") && g.charge[s]) humanShoot(g, c, pad);
    else if (fired("pass")) { const q = pickReceiver(g, c, dx, dy, false); if (q) passTo(g, c, q, false); }
    else if (fired("through")) { const q = pickReceiver(g, c, dx, dy, true); if (q) passTo(g, c, q, true, m > 0.2 ? dy : 0); }
    else if (fired("cross")) cross(g, c, m > 0.2 ? dy : 0);
  }
  if (fired("shot")) g.charge[s] = false;
  g.seen[s] = { ...pad };
  const m = hyp(pad.mx, pad.my);
  const sp = speedOf(g, c, pad.sprint);
  if (m > 0.15) { const mag = Math.min(1, m); c.dvx = (pad.mx / m) * mag * sp; c.dvy = (pad.my / m) * mag * sp; }
  // Hands off the stick: the receiver of a pass keeps running onto the ball by himself.
  else if (b.owner < 0 && c.runUntil > g.clock) setDesired(c, c.runX, c.runY, speedOf(g, c, true));
  else { c.dvx = 0; c.dvy = 0; }
}

function offBall(g: Game, dt: number, dead: boolean) {
  const b = g.ball;
  const owner = b.owner >= 0 ? g.players[b.owner]! : null;
  // While a pass travels the passing team keeps its attacking shape.
  const poss = dead ? null : owner?.side ?? (b.last >= 0 ? g.players[b.last]!.side : null);
  if (!dead && owner && !isCtrl(g, owner)) aiHolder(g, owner, dt);
  const bx = b.x + b.vx * 0.3, by = b.y + b.vy * 0.3;
  const chasers = new Set<number>();
  if (!dead) {
    for (const s of SIDES) {
      if (g.human[s] || owner?.side === s) continue;
      if (!owner && team(g, s).some((p) => p.runUntil > g.clock)) continue;
      const n = owner ? g.level.pressers : 1;
      const cand = team(g, s).filter((p) => !p.gk).sort((a, c) => hyp(a.x - bx, a.y - by) - hyp(c.x - bx, c.y - by));
      // A fast pass is only chased by someone already close to it; a slow loose ball by the nearest player.
      const fast = !owner && hyp(b.vx, b.vy) > 9;
      for (const p of cand.slice(0, n)) if (!fast || hyp(p.x - bx, p.y - by) < 6) chasers.add(p.id);
    }
  }
  for (const p of g.players) {
    if (!dead && (isCtrl(g, p) || p.id === b.owner)) continue;
    const run = speedOf(g, p, false);
    if (p.gk) { keeperMove(g, p, dead); continue; }
    if (chasers.has(p.id)) {
      const tx = owner ? owner.x + owner.vx * 0.35 : bx, ty = owner ? owner.y + owner.vy * 0.35 : by;
      // Sprint to close down, then jockey so a dribbler always has a chance.
      const close = owner && hyp(tx - p.x, ty - p.y) < 4;
      setDesired(p, tx, ty, close ? run * 0.82 : speedOf(g, p, true));
    } else if (!dead && p.runUntil > g.clock) {
      setDesired(p, p.runX, p.runY, speedOf(g, p, true));
    } else {
      const s = shape(g, p, poss);
      setDesired(p, s.x, s.y, run * 0.9);
    }
  }
}

function keeperMove(g: Game, p: GPlayer, dead: boolean) {
  const b = g.ball, d = dirOf(p.side), line = p.side === "home" ? 0 : PITCH_L;
  const bd = hyp(b.x - line, b.y - PITCH_W / 2);
  let tx = line + d * clamp(bd * 0.08, 0.8, 4);
  let ty = PITCH_W / 2 + clamp((b.y - PITCH_W / 2) * 0.35, -3, 3);
  if (!dead && b.owner < 0 && b.shot === other(p.side) && Math.sign(b.vx) === -d) {
    const tt = (p.x - b.x) / (b.vx || 1e-6);
    if (tt > 0) ty = clamp(b.y + b.vy * tt, PITCH_W / 2 - 4.2, PITCH_W / 2 + 4.2);
  } else if (!dead && b.owner < 0 && !b.shot && bd < 13 && b.z < 2) {
    tx = b.x; ty = b.y;
  }
  setDesired(p, tx, ty, 7.2 * (0.9 + p.k * 0.2));
}

function aiHolder(g: Game, o: GPlayer, dt: number) {
  const s = o.side, P = g.human[s] ? HUMAN_KEEPER : g.level, gx = goalX(s), dir = dirOf(s);
  if (o.gk) {
    o.dvx = 0; o.dvy = 0;
    if (g.clock - g.holdSince > 0.9) {
      const q = bestPass(g, o, P);
      if (q) passTo(g, o, q, false);
    }
    return;
  }
  // Dribble towards goal, sidestepping the nearest opponent.
  let near: GPlayer | null = null; let nd = Infinity;
  for (const q of g.players) {
    if (q.side === s) continue;
    const d = hyp(q.x - o.x, q.y - o.y);
    if (d < nd) { nd = d; near = q; }
  }
  let ty = PITCH_W / 2 + (o.y - PITCH_W / 2) * 0.55;
  if (near && nd < 6 && (near.x - o.x) * dir > -1) ty += Math.sign(o.y - near.y || 1) * 7;
  const tx = o.x + dir * 8;
  setDesired(o, tx, clamp(ty, 3, PITCH_W - 3), speedOf(g, o, nd > 5));
  g.aiTimer[s] -= dt;
  if (g.aiTimer[s] > 0) return;
  g.aiTimer[s] = P.react * (0.6 + g.rng() * 0.8);
  const dist = hyp(gx - o.x, PITCH_W / 2 - o.y);
  const r = g.rng();
  if ((dist < P.range && Math.abs(o.y - PITCH_W / 2) < 20 && r < 0.75) || (dist < P.range + 6 && r < 0.1)) {
    const k = keeperOf(g, other(s));
    const side = k.y > PITCH_W / 2 ? -1 : 1;
    shootAt(g, o, 0.55 + g.rng() * 0.3, PITCH_W / 2 + side * (2 + g.rng() * 1.1));
  } else if ((nd < 3.2 && r < 0.85) || r < 0.12) {
    const q = bestPass(g, o, P);
    if (q) passTo(g, o, q, false);
  } else if (Math.abs(gx - o.x) < 30 && Math.abs(o.y - PITCH_W / 2) > 16 && r < 0.5) {
    cross(g, o, 0);
  } else if (r < 0.14) {
    const q = pickReceiver(g, o, dir, 0, true);
    if (q && (q.x - o.x) * dir > 3) passTo(g, o, q, true, 0);
  }
}

function bestPass(g: Game, o: GPlayer, P: BotParams) {
  const dir = dirOf(o.side);
  let best: GPlayer | null = null; let bs = -Infinity;
  for (const q of team(g, o.side)) {
    if (q.id === o.id || q.gk) continue;
    const d = hyp(q.x - o.x, q.y - o.y);
    if (d < 4 || d > 34) continue;
    let open = 8;
    for (const e of g.players) if (e.side !== o.side) open = Math.min(open, hyp(e.x - q.x, e.y - q.y));
    const lane = laneOpen(g, o, q.x, q.y);
    const score = (q.x - o.x) * dir * 0.06 + open * 0.25 + lane * 0.6 - d * 0.02 + gauss(g.rng) * P.passErr * 0.4 - (lane < 1.6 ? 4 : 0);
    if (score > bs) { bs = score; best = q; }
  }
  return best;
}

function integrate(g: Game, dt: number) {
  const k = Math.min(1, dt * 7);
  for (const p of g.players) {
    p.vx += (p.dvx - p.vx) * k;
    p.vy += (p.dvy - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, -1, PITCH_L + 1);
    p.y = clamp(p.y + p.vy * dt, -1, PITCH_W + 1);
    if (g.ball.owner === p.id) { p.x = clamp(p.x, 0.8, PITCH_L - 0.8); p.y = clamp(p.y, 0.8, PITCH_W - 0.8); }
    const sp = hyp(p.vx, p.vy);
    if (sp > 0.6) {
      const a = g.ball.owner === p.id ? 0.35 : 0.2;
      const fx = p.fx + (p.vx / sp - p.fx) * a, fy = p.fy + (p.vy / sp - p.fy) * a, f = hyp(fx, fy) || 1;
      p.fx = fx / f; p.fy = fy / f;
    }
  }
  const ps = g.players;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!, c = ps[j]!;
      const dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
      if (d > 0.001 && d < SEPARATION) {
        const push = (SEPARATION - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        c.x += (dx / d) * push; c.y += (dy / d) * push;
      }
    }
  }
}

function ballFree(g: Game, dt: number) {
  const b = g.ball;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= 9.81 * dt;
    b.vx *= 1 - 0.08 * dt; b.vy *= 1 - 0.08 * dt;
  }
  if (b.z <= 0) {
    b.z = 0;
    if (b.vz < -1.5) { b.vz = -b.vz * 0.42; b.vx *= 0.85; b.vy *= 0.85; } else b.vz = 0;
  }
  if (b.z === 0 && b.vz === 0) {
    const sp = hyp(b.vx, b.vy);
    if (sp > 0) {
      const ns = Math.max(0, sp - (0.32 * sp + 0.9) * dt);
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
  }
  if (b.shot && hyp(b.vx, b.vy) < 7) b.shot = null;
}

function keeperSave(g: Game) {
  const b = g.ball;
  if (!b.shot || b.tried) return;
  const def = other(b.shot);
  const k = keeperOf(g, def);
  const d = hyp(b.x - k.x, b.y - k.y);
  const sp = hyp(b.vx, b.vy);
  // Slow balls (long-range shots) give the keeper time: wider reach and an easier save.
  if (d > 1.2 + 1.1 * k.k + Math.max(0, 22 - sp) * 0.12 || b.z > 2.7 || k.lock > 0) return;
  b.tried = true;
  const p = clamp(0.34 + 0.5 * k.k - (sp - 20) * 0.02 - d * 0.08 + Math.max(0, 18 - sp) * 0.05 + (g.human[def] ? 0 : g.level.keeper), 0.08, 0.95);
  if (g.rng() >= p) return;
  if (sp < 21) {
    gain(g, k, false);
    g.holdSince = g.clock;
  } else {
    b.vx = -b.vx * 0.3; b.vy = (g.rng() - 0.5) * 14; b.vz = 1.5 + g.rng() * 2;
    b.shot = null; b.last = k.id; k.lock = 0.4;
  }
  emit(g, "save", k, def);
}

function rules(g: Game) {
  const b = g.ball;
  const lastSide = b.last >= 0 ? g.players[b.last]!.side : g.kickoff;
  if (b.x > PITCH_L || b.x < 0) {
    const scorer: Side = b.x > PITCH_L ? "home" : "away";
    const off = Math.abs(b.y - PITCH_W / 2);
    if (off < GOAL_HALF && b.z < GOAL_H) {
      g.score[scorer] += 1;
      const p = b.last >= 0 ? g.players[b.last]! : null;
      emit(g, "goal", p, scorer);
      g.phase = "goal";
      g.phaseT = 2.6;
      g.kickoff = other(scorer);
      b.shot = null;
      b.vx *= 0.15; b.vy *= 0.15;
      return;
    }
    if ((off < GOAL_HALF + 0.3 && b.z < GOAL_H + 0.2) || (off < GOAL_HALF && b.z < GOAL_H + 0.3)) {
      b.vx = -b.vx * 0.55; b.x = clamp(b.x, 0.1, PITCH_L - 0.1); b.vy += (g.rng() - 0.5) * 4;
      b.shot = null;
      emit(g, "post", null, scorer);
      return;
    }
    const def = other(scorer);
    if (lastSide === scorer) {
      const k = keeperOf(g, def);
      restart(g, k, def === "home" ? 5.5 : PITCH_L - 5.5, PITCH_W / 2);
    } else {
      const cy = b.y < PITCH_W / 2 ? 0.6 : PITCH_W - 0.6;
      const cx = scorer === "home" ? PITCH_L - 0.6 : 0.6;
      const t = nearestTo(g, scorer, cx, cy, -1)!;
      restart(g, t, cx, cy);
    }
    return;
  }
  if (b.y < 0 || b.y > PITCH_W) {
    const s = other(lastSide);
    const ty = b.y < 0 ? 0.6 : PITCH_W - 0.6, tx = clamp(b.x, 1, PITCH_L - 1);
    restart(g, nearestTo(g, s, tx, ty, -1)!, tx, ty);
  }
}

function contest(g: Game, pads: Pads, dt: number) {
  const b = g.ball;
  if (b.owner < 0) {
    const sp = hyp(b.vx, b.vy);
    let best: GPlayer | null = null; let bd = Infinity;
    for (const p of g.players) {
      if (p.lock > 0) continue;
      // A shot on target is the keeper's to save (keeperSave), not to simply collect.
      if (p.gk && b.shot && b.shot !== p.side) continue;
      const inBox = p.gk && Math.abs(p.x - (p.side === "home" ? 0 : PITCH_L)) < 16.5 && Math.abs(p.y - PITCH_W / 2) < 20;
      const r = inBox ? 1.5 : sp > 18 ? 0.85 : 1.15;
      if (b.z > (inBox ? 2.5 : 1.9)) continue;
      const d = hyp(b.x - p.x, b.y - p.y);
      if (d < r && d < bd) { bd = d; best = p; }
    }
    if (best) gain(g, best, false);
    return;
  }
  if (g.clock < g.protectUntil) return;
  const o = g.players[b.owner]!;
  for (const q of g.players) {
    if (q.side === o.side || q.lock > 0) continue;
    const d = hyp(q.x - o.x, q.y - o.y);
    if (d > TACKLE_RANGE) continue;
    let win = false;
    if (isCtrl(g, q)) {
      const pad = pads[q.side] ?? g.seen[q.side];
      win = canSteal(d, pad.shootHeld);
    } else if (d < 1) {
      const rate = (g.human[q.side] ? 0.7 : g.level.steal) * (1 + (q.k - o.k) * 0.8);
      win = g.rng() < rate * dt;
    }
    if (win) {
      o.lock = 0.6;
      gain(g, q, true);
      return;
    }
  }
}

// ---------- Network snapshots (live matches: the home player hosts) ----------

export interface Snap {
  c: number; t: number; h: 1 | 2; ph: Phase; pt: number; s: [number, number]; b: [number, number, number];
  o: number; k: [number, number]; ch: [boolean, boolean]; p: number[]; e: GameEvent[];
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function toSnap(g: Game): Snap {
  const p: number[] = [];
  for (const pl of g.players) p.push(r2(pl.x), r2(pl.y));
  return {
    c: r2(g.clock), t: r2(g.t), h: g.half, ph: g.phase, pt: r2(g.phaseT), s: [g.score.home, g.score.away],
    b: [r2(g.ball.x), r2(g.ball.y), r2(g.ball.z)], o: g.ball.owner, k: [g.ctrl.home, g.ctrl.away],
    ch: [g.charge.home, g.charge.away], p, e: g.events.slice(-6),
  };
}

/** Guest view: interpolate between the last two host snapshots (alpha 0..1). */
export function applySnap(g: Game, a: Snap | null, b: Snap, alpha: number) {
  const A = a ?? b;
  const l = (x: number, y: number) => x + (y - x) * alpha;
  g.players.forEach((pl, i) => {
    const x = l(A.p[i * 2] ?? 0, b.p[i * 2] ?? 0), y = l(A.p[i * 2 + 1] ?? 0, b.p[i * 2 + 1] ?? 0);
    const dx = x - pl.x, dy = y - pl.y, d = hyp(dx, dy);
    if (d > 0.02 && d < 3) { pl.fx = dx / d; pl.fy = dy / d; }
    pl.vx = dx * 60; pl.vy = dy * 60;
    pl.x = x; pl.y = y;
  });
  const owner = b.o;
  g.ball.x = owner >= 0 ? b.b[0] : l(A.b[0], b.b[0]);
  g.ball.y = owner >= 0 ? b.b[1] : l(A.b[1], b.b[1]);
  g.ball.z = l(A.b[2], b.b[2]);
  g.ball.owner = owner;
  g.clock = b.c; g.t = l(A.t, b.t); g.half = b.h; g.phase = b.ph; g.phaseT = b.pt;
  g.score = { home: b.s[0], away: b.s[1] };
  g.ctrl = { home: b.k[0], away: b.k[1] };
  g.charge = { home: b.ch[0], away: b.ch[1] };
  for (const e of b.e) if (!g.events.some((x) => x.id === e.id)) g.events.push(e);
  if (g.events.length > 12) g.events.splice(0, g.events.length - 12);
  g.nextEvent = Math.max(g.nextEvent, ...b.e.map((e) => e.id));
}

// ---------- Shapes returned by get_live_match ----------

export interface LiveSideView { id: string | null; name: string | null; team: RatedTeam | null; goals: number; reward: number | null; reported: boolean }
export interface LiveMatchView {
  id: string; mode: "bot" | "live"; bot_level: BotLevel | null; status: "pending" | "playing" | "finished" | "cancelled" | "declined";
  side: Side; result: "home" | "away" | "draw" | null; disputed: boolean; forfeit_by: Side | null;
  home: LiveSideView; away: LiveSideView; created_at: string; started_at: string | null; finished_at: string | null; now: string;
}
export interface MyLiveMatch {
  match_id: string; mode: "bot" | "live"; bot_level: BotLevel | null; status: LiveMatchView["status"]; is_home: boolean;
  opponent_name: string | null; my_goals: number; their_goals: number; result: "win" | "loss" | "draw" | null;
  my_reward: number | null; incoming: boolean; created_at: string; finished_at: string | null;
}
export const botName = (level: BotLevel | null) => `Ordi ${BOT_LEVELS[level ?? "legendaire"].label}`;

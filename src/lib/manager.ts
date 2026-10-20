// 11 v 11 manager mode rules. The server (_mm_rate, _mm_fit, _mm_sim_half, _mm_second_half, save_manager_team) is the
// source of truth; these pure helpers mirror it so the team builder can preview ratings before saving.
import { rarityMeta } from "@/lib/rarity";

export const XI_SIZE = 11;
export const BENCH_SIZE = 5;
export const MAX_SUBS = 3;
/** Real seconds per half on the board. */
export const HALF_SECONDS = 80;
export const DAILY_REWARDED_MATCHES = 5;
export const HALFTIME_TIMEOUT_HOURS = 24;
export const INVITE_TIMEOUT_HOURS = 48;

export type Line = "gk" | "def" | "mid" | "att";
export type Tactic = "offensive" | "equilibre" | "defensive";
export type FormationKey = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-4-3" | "5-3-2";

export interface FormationSlot { role: string; line: Line; x: number; y: number }

/** Slot coordinates: x = depth towards the opponent goal (0 = own goal line), y = width (0 = left touchline). */
const s = (role: string, line: Line, x: number, y: number): FormationSlot => ({ role, line, x, y });
const GK = s("G", "gk", 5, 50);
const BACK4 = [s("DG", "def", 20, 15), s("DC", "def", 18, 38), s("DC", "def", 18, 62), s("DD", "def", 20, 85)];

export const FORMATIONS: Record<FormationKey, { label: string; slots: FormationSlot[] }> = {
  "4-3-3": { label: "4-3-3", slots: [GK, ...BACK4, s("MC", "mid", 34, 28), s("MDC", "mid", 30, 50), s("MC", "mid", 34, 72), s("AG", "att", 46, 18), s("BU", "att", 48, 50), s("AD", "att", 46, 82)] },
  "4-4-2": { label: "4-4-2", slots: [GK, ...BACK4, s("AG", "mid", 34, 15), s("MC", "mid", 32, 38), s("MC", "mid", 32, 62), s("AD", "mid", 34, 85), s("BU", "att", 47, 38), s("BU", "att", 47, 62)] },
  "4-2-3-1": { label: "4-2-3-1", slots: [GK, ...BACK4, s("MDC", "mid", 29, 38), s("MDC", "mid", 29, 62), s("AG", "att", 40, 18), s("MOC", "mid", 40, 50), s("AD", "att", 40, 82), s("BU", "att", 48, 50)] },
  "3-4-3": { label: "3-4-3", slots: [GK, s("DC", "def", 18, 28), s("DC", "def", 17, 50), s("DC", "def", 18, 72), s("DG", "mid", 32, 12), s("MC", "mid", 31, 38), s("MC", "mid", 31, 62), s("DD", "mid", 32, 88), s("AG", "att", 46, 20), s("BU", "att", 48, 50), s("AD", "att", 46, 80)] },
  "5-3-2": { label: "5-3-2", slots: [GK, s("DG", "def", 22, 10), s("DC", "def", 17, 30), s("DC", "def", 16, 50), s("DC", "def", 17, 70), s("DD", "def", 22, 90), s("MC", "mid", 33, 28), s("MDC", "mid", 30, 50), s("MC", "mid", 33, 72), s("BU", "att", 47, 38), s("BU", "att", 47, 62)] },
};
export const FORMATION_KEYS = Object.keys(FORMATIONS) as FormationKey[];

export const TACTICS: Record<Tactic, { label: string; hint: string }> = {
  offensive: { label: "Offensive", hint: "Attaque +3, défense −3" },
  equilibre: { label: "Équilibrée", hint: "Aucun changement" },
  defensive: { label: "Défensive", hint: "Défense +3, attaque −3" },
};

export const POSITION_LABEL: Record<string, string> = {
  G: "Gardien", DG: "Défenseur gauche", DC: "Défenseur central", DD: "Défenseur droit", MDC: "Milieu défensif",
  MC: "Milieu central", MOC: "Milieu offensif", AG: "Ailier gauche", AD: "Ailier droit", BU: "Buteur",
};

const CLOSE: Record<string, string[]> = {
  BU: ["AD", "AG", "MOC"], AD: ["AG", "BU"], AG: ["AD", "BU"], MOC: ["MC", "BU"], MC: ["MDC", "MOC"],
  MDC: ["MC", "DC"], DC: ["MDC", "DD", "DG"], DD: ["DG", "DC"], DG: ["DD", "DC"],
};

/** 0 at his own position, −3 at a close one, −10 elsewhere, −30 for a keeper out of goal or an outfield player in goal. */
export function positionFit(pos: string, role: string) {
  const p = pos.toUpperCase();
  if (p === role) return 0;
  if (p === "G" || role === "G") return -30;
  return CLOSE[role]?.includes(p) ? -3 : -10;
}

const RARITY_BONUS: Record<string, number> = { uncommon: 1, rare: 2, super_rare: 3, legendary: 4, secret_legendary: 5 };

/** Rarity bonus (+0 to +5, played as the built-in base) and +2 for ALT/Shiny versions. */
export function rarityBonus(rarity: string, version?: string | null) {
  return (RARITY_BONUS[rarityMeta(rarity).play] ?? 0) + (version === "alt" || version === "shiny" ? 2 : 0);
}

/** Club mates: 1 → +1, 2+ → +2. Nationality mates: 2-3 → +1, 4+ → +2. Nothing for a player out of position. */
export function chemistry(clubMates: number, nationMates: number, fit: number) {
  if (fit <= -10) return 0;
  return (clubMates >= 2 ? 2 : clubMates === 1 ? 1 : 0) + (nationMates >= 4 ? 2 : nationMates >= 2 ? 1 : 0);
}

export interface MatchCard {
  user_card_id: string; card_id: string; name: string; club: string; nationality: string;
  pos: string; rating: number; rarity: string; version: string; image_url: string | null;
}
export interface RatedPlayer extends MatchCard { slot: number; role: string; line: Line; fit: number; chem: number; eff: number }
export interface RatedTeam {
  formation: FormationKey; tactic: Tactic; players: RatedPlayer[]; bench: MatchCard[];
  general: number; collectif: number; force: number; attack: number; midfield: number; defense: number; keeper: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Rate a full XI exactly like _mm_rate. */
export function rateTeam(formation: FormationKey, tactic: Tactic, xi: MatchCard[], bench: MatchCard[] = []): RatedTeam {
  const slots = FORMATIONS[formation].slots;
  const players: RatedPlayer[] = xi.map((p, i) => {
    const slot = slots[i]!;
    const fit = positionFit(p.pos, slot.role);
    const others = xi.filter((_, j) => j !== i);
    const cm = others.filter((q) => q.club.toLowerCase() === p.club.toLowerCase()).length;
    const nm = others.filter((q) => q.nationality.toLowerCase() === p.nationality.toLowerCase()).length;
    const chem = chemistry(cm, nm, fit);
    return { ...p, slot: i, role: slot.role, line: slot.line, fit, chem, eff: p.rating + rarityBonus(p.rarity, p.version) + chem + fit };
  });
  const by = (l: Line) => players.filter((p) => p.line === l).map((p) => p.eff);
  const att = by("att"), mid = by("mid"), def = by("def");
  const t = tactic === "offensive" ? 3 : tactic === "defensive" ? -3 : 0;
  return {
    formation, tactic, players, bench,
    general: Math.round(avg(players.map((p) => p.rating))),
    collectif: Math.round((players.reduce((x, p) => x + p.chem, 0) * 100) / 44),
    force: Math.round(avg(players.map((p) => p.eff))),
    attack: r1(0.65 * avg(att) + 0.35 * avg(mid) + (att.length - 3) * 2 + t),
    midfield: r1(avg(mid) + (mid.length - 3) * 2),
    defense: r1(0.75 * avg(def) + 0.25 * avg(mid) + (def.length - 4) * 2 - t),
    keeper: by("gk")[0] ?? 0,
  };
}

/** Cards that can never play a match. */
export const canPlayMatch = (c: Pick<MatchCard, "pos" | "rarity">) =>
  c.pos.toUpperCase() !== "CLUB" && rarityMeta(c.rarity).play !== "secret_ultimate";

/** French reason the team cannot be saved, or null when it is valid. */
export function teamProblem(xi: (MatchCard | null | undefined)[], bench: (MatchCard | null | undefined)[]) {
  const starters = xi.filter(Boolean) as MatchCard[];
  if (starters.length !== XI_SIZE) return `Choisis tes ${XI_SIZE} titulaires (${starters.length}/${XI_SIZE})`;
  const subs = bench.filter(Boolean) as MatchCard[];
  if (subs.length > BENCH_SIZE) return `${BENCH_SIZE} remplaçants au maximum`;
  const all = [...starters, ...subs];
  if (all.some((c) => !canPlayMatch(c))) return "Les cartes Club et Secrète Ultime ne jouent pas en match";
  if (new Set(all.map((c) => c.card_id)).size !== all.length) return "Un même joueur ne peut pas être deux fois dans ton équipe";
  return null;
}

/** Coins for one finished match (before the daily cap). */
export const matchPayout = (score: 0 | 0.5 | 1) => (score === 1 ? 150 : score === 0.5 ? 60 : 30);

/** First name shown above a pawn (single-word names stay whole). */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Fill each slot with the owned card that plays it best (greedy, best slots first), then the bench with the best of the rest. */
export function autoPick(formation: FormationKey, options: MatchCard[]): { xi: (MatchCard | null)[]; bench: MatchCard[] } {
  const pool = options.filter(canPlayMatch);
  const used = new Set<string>();
  const slots = FORMATIONS[formation].slots.map((sl, i) => ({ sl, i }));
  const xi: (MatchCard | null)[] = Array(XI_SIZE).fill(null);
  // Keepers and scarce roles first so a good keeper is never spent elsewhere.
  const order = [...slots].sort((a, b) => (a.sl.role === "G" ? -1 : b.sl.role === "G" ? 1 : 0));
  for (const { sl, i } of order) {
    let best: MatchCard | null = null; let bestScore = -Infinity;
    for (const c of pool) {
      if (used.has(c.card_id)) continue;
      const score = c.rating + rarityBonus(c.rarity, c.version) + positionFit(c.pos, sl.role);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (best) { xi[i] = best; used.add(best.card_id); }
  }
  const bench = pool.filter((c) => !used.has(c.card_id))
    .sort((a, b) => b.rating + rarityBonus(b.rarity, b.version) - (a.rating + rarityBonus(a.rarity, a.version)))
    .filter((c) => { if (used.has(c.card_id)) return false; used.add(c.card_id); return true; })
    .slice(0, BENCH_SIZE);
  return { xi, bench };
}

/** Clock shown on the board: a half of HALF_SECONDS lasts 45 minutes. */
export function matchClock(half: 1 | 2, t: number, length = HALF_SECONDS) {
  const total = (Math.min(Math.max(t, 0), length) / length) * 45 * 60 + (half === 2 ? 45 * 60 : 0);
  const m = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const minuteOf = (half: 1 | 2, t: number, length = HALF_SECONDS) =>
  Math.min(45, Math.floor((Math.min(Math.max(t, 0), length) / length) * 45) + 1) + (half === 2 ? 45 : 0);

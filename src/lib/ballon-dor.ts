// Ballon d'Or ceremony rules mirrored from the admin_* SQL functions (status flow, trophies, seating).

export type CeremonyStatus = "scheduled" | "live" | "finished" | "cancelled";
export interface Ceremony {
  id: string; title: string; scheduled_at: string; reward_coins: number; trophy_coins?: number; status: CeremonyStatus;
  winner_id: string | null; winner_name: string | null; started_at: string | null; awarded_at: string | null; created_at: string;
}

/** A just-awarded ceremony stays on stage this long before the hall moves on to the next one. */
export const STAGE_AFTER_AWARD_MS = 3 * 60 * 60 * 1000;

/** The ceremony the hall shows: the live one, else one awarded in the last 3 hours, else the next scheduled one, else the last finished one. */
export function currentCeremony(list: Ceremony[], now = Date.now()): Ceremony | null {
  const live = list.find((c) => c.status === "live");
  if (live) return live;
  const recent = list
    .filter((c) => c.status === "finished" && c.awarded_at && now - new Date(c.awarded_at).getTime() < STAGE_AFTER_AWARD_MS)
    .sort((a, b) => (b.awarded_at ?? "").localeCompare(a.awarded_at ?? ""))[0];
  if (recent) return recent;
  const next = list.filter((c) => c.status === "scheduled").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  if (next) return next;
  return list.filter((c) => c.status === "finished").sort((a, b) => (b.awarded_at ?? "").localeCompare(a.awarded_at ?? ""))[0] ?? null;
}

export const canStart = (c: Ceremony, list: Ceremony[]) => c.status === "scheduled" && !list.some((o) => o.status === "live" && o.id !== c.id);
export const canAward = (c: Ceremony) => c.status === "live";
export const canCancel = (c: Ceremony) => c.status === "scheduled" || c.status === "live";

/** Ballons d'Or won by a player, newest first. */
export function trophiesOf(list: Ceremony[], userId: string): Ceremony[] {
  return list.filter((c) => c.status === "finished" && c.winner_id === userId).sort((a, b) => (b.awarded_at ?? "").localeCompare(a.awarded_at ?? ""));
}

export const MAX_AUDIENCE = 40;
export const SEATS_PER_ROW = 8;

/** Seat positions for the audience, rows rising away from the stage (stage at negative z). */
export function seatPosition(i: number): [number, number, number] {
  const row = Math.floor(i / SEATS_PER_ROW);
  const col = i % SEATS_PER_ROW;
  const offset = row % 2 ? 0.45 : 0;
  return [(col - (SEATS_PER_ROW - 1) / 2) * 1.25 + offset, row * 0.45, 3 + row * 1.5];
}

export function countdown(ms: number): string {
  if (ms <= 0) return "maintenant";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min ${String(sec).padStart(2, "0")} s`;
}

/* ---------------- Side trophies (handed out before the Ballon d'Or) ---------------- */

export type AwardKind = "rarest_card" | "most_wins";
export type TrophyKind = AwardKind | "ballon";
export interface CeremonyAward {
  id: string; ceremony_id: string; kind: AwardKind; winner_id: string | null; winner_name: string;
  detail: string; reward_coins: number; awarded_at: string;
}

/** Order of the evening: these come first, the Ballon d'Or always last (enforced by admin_award_ballon_dor). */
export const SIDE_TROPHIES: AwardKind[] = ["rarest_card", "most_wins"];
export const TROPHY_LABEL: Record<TrophyKind, string> = {
  rarest_card: "Trophée de la carte la plus rare",
  most_wins: "Trophée des matchs gagnés",
  ballon: "Ballon d'Or",
};

/** What the admin hands out next in a live ceremony: side trophies not yet given (skipping one nobody qualifies for), then the Ballon d'Or. */
export function nextTrophy(awards: CeremonyAward[], ceremonyId: string, hasContender: Record<AwardKind, boolean>): TrophyKind {
  for (const k of SIDE_TROPHIES) {
    if (hasContender[k] && !awards.some((a) => a.ceremony_id === ceremonyId && a.kind === k)) return k;
  }
  return "ballon";
}

/** Trophies of this ceremony already handed out. */
export function awardedIn(c: Ceremony | null, awards: CeremonyAward[]): TrophyKind[] {
  if (!c) return [];
  const out: TrophyKind[] = awards.filter((a) => a.ceremony_id === c.id).map((a) => a.kind);
  if (c.status === "finished") out.push("ballon");
  return out;
}

export interface StageMoment { key: string; kind: TrophyKind; winnerId: string | null; winnerName: string; detail: string; coins: number }

/** The trophy on stage right now: the Ballon d'Or once awarded, else the latest side trophy of this ceremony. */
export function stageMoment(c: Ceremony | null, awards: CeremonyAward[]): StageMoment | null {
  if (!c) return null;
  if (c.status === "finished" && c.winner_name) {
    return { key: `${c.id}:ballon`, kind: "ballon", winnerId: c.winner_id, winnerName: c.winner_name, detail: "", coins: c.reward_coins };
  }
  if (c.status !== "live") return null;
  const last = awards.filter((a) => a.ceremony_id === c.id).sort((a, b) => b.awarded_at.localeCompare(a.awarded_at))[0];
  return last ? { key: `${c.id}:${last.kind}`, kind: last.kind, winnerId: last.winner_id, winnerName: last.winner_name, detail: last.detail, coins: last.reward_coins } : null;
}

/** Side trophies won by a player, newest first. */
export function sideTrophiesOf(awards: CeremonyAward[], userId: string): CeremonyAward[] {
  return awards.filter((a) => a.winner_id === userId).sort((a, b) => b.awarded_at.localeCompare(a.awarded_at));
}

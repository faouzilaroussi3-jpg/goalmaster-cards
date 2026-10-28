// Ballon d'Or ceremony rules mirrored from the admin_* SQL functions (status flow, trophies, seating).

export type CeremonyStatus = "scheduled" | "live" | "finished" | "cancelled";
export interface Ceremony {
  id: string; title: string; scheduled_at: string; reward_coins: number; status: CeremonyStatus;
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

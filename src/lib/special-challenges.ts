// Admin-made special challenges: start when created, disappear when their duration is over.
// The server (admin_create_special_challenge) enforces the same limits; these mirror them for the form.

export type DurationUnit = "hours" | "days";

export const MIN_MINUTES = 60; // 1 hour
export const MAX_MINUTES = 90 * 24 * 60; // 90 days
export const TITLE_MAX = 60;
export const TARGET_MAX = 10_000;
export const COINS_MAX = 1_000_000;
export const PACKS_MAX = 50;

export const DURATION_PRESETS: { label: string; amount: number; unit: DurationUnit }[] = [
  { label: "1 h", amount: 1, unit: "hours" },
  { label: "6 h", amount: 6, unit: "hours" },
  { label: "24 h", amount: 24, unit: "hours" },
  { label: "3 jours", amount: 3, unit: "days" },
  { label: "7 jours", amount: 7, unit: "days" },
  { label: "30 jours", amount: 30, unit: "days" },
];

export function durationMinutes(amount: number, unit: DurationUnit) {
  return Math.round(amount * (unit === "days" ? 1440 : 60));
}

export type SpecialMetric = "packs" | "cards" | "rarity" | "version" | "duels_played" | "duels_won";

export const SPECIAL_METRICS: { key: SpecialMetric; label: string }[] = [
  { key: "packs", label: "Ouvrir des packs" },
  { key: "cards", label: "Tirer des cartes" },
  { key: "rarity", label: "Tirer des cartes d'une rareté" },
  { key: "version", label: "Tirer des ALT / Shiny" },
  { key: "duels_played", label: "Terminer des duels" },
  { key: "duels_won", label: "Gagner des duels" },
];

export interface SpecialForm {
  title: string;
  metric: SpecialMetric;
  rarity: string;
  version: "alt" | "shiny";
  target: number;
  coins: number;
  packKey: string;
  packs: number;
  amount: number;
  unit: DurationUnit;
}

/** First problem with the form, or null when it can be created. */
export function specialError(f: SpecialForm): string | null {
  const title = f.title.trim();
  if (!title) return "Donne un titre au défi";
  if (title.length > TITLE_MAX) return `Titre trop long (${TITLE_MAX} caractères max)`;
  if (!Number.isInteger(f.target) || f.target < 1 || f.target > TARGET_MAX) return `L'objectif doit être entre 1 et ${TARGET_MAX.toLocaleString("fr-FR")}`;
  if (f.metric === "rarity" && (!f.rarity || f.rarity === "secret_ultimate")) return "Choisis une rareté";
  if (f.coins < 0 || f.coins > COINS_MAX) return "Pièces : entre 0 et 1 000 000";
  if (f.packs < 0 || f.packs > PACKS_MAX) return `Packs : entre 0 et ${PACKS_MAX}`;
  if (f.coins === 0 && f.packs === 0) return "Mets au moins une récompense (pièces ou packs)";
  if (f.packs > 0 && !f.packKey) return "Choisis le pack offert";
  const min = durationMinutes(f.amount, f.unit);
  if (!(min >= MIN_MINUTES) || min > MAX_MINUTES) return "La durée doit être entre 1 heure et 90 jours";
  return null;
}

export type SpecialStatus = "live" | "ended";

export function specialStatus(c: { ends_at: string | null }, now: number = Date.now()): SpecialStatus {
  return c.ends_at && new Date(c.ends_at).getTime() > now ? "live" : "ended";
}

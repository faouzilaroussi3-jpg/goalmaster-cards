/** Admin gift rules shared by the UI; admin_grant in the database enforces the same limits. */

export const MAX_PACKS_PER_SEND = 10_000;
export const MAX_COINS_PER_SEND = 100_000_000;
export const MAX_COPIES_PER_SEND = 100;
export const NOTE_MAX = 200;

export type GiftVersion = "normal" | "alt" | "shiny";

export interface GiftForm {
  allPlayers: boolean;
  userId: string | null;
  packKey: string;
  packs: number;
  coins: number;
  cardId: string | null;
  version: GiftVersion;
  copies: number;
  note: string;
}

export interface GiftCard {
  has_alt: boolean;
  has_shiny: boolean;
}

/** French error to show, or null when the gift can be sent. */
export function giftError(f: GiftForm, card?: GiftCard | null): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= 0;
  if (!f.allPlayers && !f.userId) return "Choisis un joueur";
  if (!whole(f.packs) || f.packs > MAX_PACKS_PER_SEND) return `Entre 0 et ${MAX_PACKS_PER_SEND.toLocaleString("fr-FR")} packs par envoi`;
  if (!whole(f.coins) || f.coins > MAX_COINS_PER_SEND) return `Entre 0 et ${MAX_COINS_PER_SEND.toLocaleString("fr-FR")} pièces par envoi`;
  if (!whole(f.copies) || f.copies > MAX_COPIES_PER_SEND) return `Entre 0 et ${MAX_COPIES_PER_SEND} exemplaires par envoi`;
  if (f.packs === 0 && f.coins === 0 && f.copies === 0) return "Rien à envoyer";
  if (f.packs > 0 && !f.packKey) return "Choisis un pack";
  if (f.copies > 0) {
    if (!f.cardId || !card) return "Choisis une carte";
    if (f.version === "alt" && !card.has_alt) return "Cette carte n'a pas de version ALT";
    if (f.version === "shiny" && !card.has_shiny) return "Cette carte n'a pas de version Shiny";
  }
  if (f.note.trim().length > NOTE_MAX) return `Message de ${NOTE_MAX} caractères maximum`;
  return null;
}

export interface GiftNotice {
  pack_name: string | null;
  packs: number;
  coins: number;
  card_name: string | null;
  card_version: string | null;
  card_copies: number;
}

const plural = (n: number, word: string) => `${n.toLocaleString("fr-FR")} ${word}${n > 1 ? "s" : ""}`;

/** Short French summary of one gift, e.g. "3 packs Premium · 5 000 pièces". */
export function giftSummary(g: GiftNotice): string {
  const parts: string[] = [];
  if (g.packs > 0) parts.push(`${plural(g.packs, "pack")}${g.pack_name ? ` ${g.pack_name}` : ""}`);
  if (g.coins > 0) parts.push(plural(g.coins, "pièce"));
  if (g.card_copies > 0) {
    const v = g.card_version === "alt" ? " ALT" : g.card_version === "shiny" ? " Shiny" : "";
    parts.push(`${g.card_copies > 1 ? `${g.card_copies}× ` : ""}${g.card_name ?? "carte"}${v}`);
  }
  return parts.join(" · ");
}

// Rules for admin-created rarities, mirrored from the database (_validate_rarity, admin_create_rarity, admin_delete_rarity).
import type { RarityKey } from "@/lib/rarity";

/** Visual effects an admin can give a new rarity: the look of each built-in rarity. */
export const RARITY_EFFECTS: { fx: RarityKey; label: string; hint: string }[] = [
  { fx: "common", label: "Simple", hint: "Cadre sobre, comme une Commune" },
  { fx: "uncommon", label: "Liseré", hint: "Cadre coloré, comme une Peu commune" },
  { fx: "rare", label: "Reflet brillant", hint: "Reflet qui passe sur la carte, comme une Rare" },
  { fx: "super_rare", label: "Étincelles", hint: "Reflet + étincelles, comme une Super Rare" },
  { fx: "legendary", label: "Or et paillettes", hint: "Bordure dorée pailletée, comme une Légendaire" },
  { fx: "secret_legendary", label: "Diamant", hint: "Bordure diamant + diamants en orbite, comme une Secrète Légendaire" },
  { fx: "secret_ultimate", label: "Rouge métal, feu et dragon", hint: "Rouge métallisé, feu et dragon, comme une Secrète Ultime" },
];

export const LABEL_MAX = 30;
export const SHORT_MAX = 4;
export const DUPLICATE_COINS_MAX = 100_000;

export interface RarityDraft {
  label: string;
  short: string;
  effect: string;
  color: string;
  duplicateCoins: number;
}

/** First problem with a new rarity, or null when the database will accept it. */
export function rarityDraftError(d: RarityDraft): string | null {
  const label = d.label.trim(), short = d.short.trim();
  if (label.length < 1 || label.length > LABEL_MAX) return `Nom : 1 à ${LABEL_MAX} caractères`;
  if (short.length < 1 || short.length > SHORT_MAX) return `Sigle : 1 à ${SHORT_MAX} caractères`;
  if (!RARITY_EFFECTS.some((e) => e.fx === d.effect)) return "Choisis un effet visuel";
  if (d.color.trim() && !/^#[0-9a-fA-F]{6}$/.test(d.color.trim())) return "Couleur invalide";
  if (!Number.isInteger(d.duplicateCoins) || d.duplicateCoins < 0 || d.duplicateCoins > DUPLICATE_COINS_MAX) return `Pièces par doublon : 0 à ${DUPLICATE_COINS_MAX.toLocaleString("fr-FR")}`;
  return null;
}

/** Rank given to a rarity placed right after `after` (next = rank of the following rarity, if any). */
export function rankAfter(after: number, next: number | null): number {
  return next === null ? after + 1 : (after + next) / 2;
}

/** Only admin-created rarities can be deleted, and their cards need a different rarity to move to. */
export function canDeleteRarity(r: { key: string; builtin: boolean }, moveTo: string | null): boolean {
  return !r.builtin && !!moveTo && moveTo !== r.key;
}

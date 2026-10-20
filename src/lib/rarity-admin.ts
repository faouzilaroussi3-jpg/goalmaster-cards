// Rules for admin-created rarities, mirrored from the database (_validate_rarity, admin_create_rarity, admin_delete_rarity).
import type { RarityEffect } from "@/lib/rarity";

/** Visual effects an admin can give a new rarity: the look of each built-in rarity, then 8 extra styles (isNew). */
export const RARITY_EFFECTS: { fx: RarityEffect; label: string; hint: string; isNew?: boolean }[] = [
  { fx: "common", label: "Simple", hint: "Cadre sobre, comme une Commune" },
  { fx: "uncommon", label: "Liseré", hint: "Cadre coloré, comme une Peu commune" },
  { fx: "rare", label: "Reflet brillant", hint: "Reflet qui passe sur la carte, comme une Rare" },
  { fx: "super_rare", label: "Étincelles", hint: "Reflet + étincelles, comme une Super Rare" },
  { fx: "legendary", label: "Or et paillettes", hint: "Bordure dorée pailletée, comme une Légendaire" },
  { fx: "secret_legendary", label: "Diamant", hint: "Bordure diamant + diamants en orbite, comme une Secrète Légendaire" },
  { fx: "secret_ultimate", label: "Rouge métal, feu et dragon", hint: "Rouge métallisé, feu et dragon, comme une Secrète Ultime" },
  { fx: "metal", label: "Métallique", hint: "Chrome brossé avec reflet d'acier qui glisse", isNew: true },
  { fx: "tinted", label: "Teinté", hint: "Photo teintée dans la couleur de la rareté", isNew: true },
  { fx: "cartoon", label: "Cartoon", hint: "Gros contour noir, trame BD et couleurs vives", isNew: true },
  { fx: "vintage", label: "Vintage", hint: "Photo sépia, papier ancien et bord crème", isNew: true },
  { fx: "neon", label: "Néon", hint: "Tube néon lumineux qui clignote autour de la carte", isNew: true },
  { fx: "holo", label: "Holographique", hint: "Film holographique arc-en-ciel sur toute la carte", isNew: true },
  { fx: "frost", label: "Glace", hint: "Bordure givrée, cristaux et neige qui tombe", isNew: true },
  { fx: "galaxy", label: "Galaxie", hint: "Nébuleuse cosmique et étoiles qui scintillent", isNew: true },
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

type PackRates = { name: string; active: boolean; slot_rates: unknown };
const inactiveSet = (rarities: { key: string; active: boolean }[]) => new Set(rarities.filter((r) => !r.active).map((r) => r.key));

/** Drop chances a pack really uses: switched-off rarities are left out (the others share their chance). Mirrors _draw_key. */
export function activeRates(rates: Record<string, number>, rarities: { key: string; active: boolean }[]): Record<string, number> {
  const off = inactiveSet(rarities);
  return Object.fromEntries(Object.entries(rates).filter(([k, v]) => !off.has(k) && Number(v) > 0));
}

/** Name of an active pack that would have nothing left to drop if `key` were switched off, or null. Mirrors admin_set_rarity_active. */
export function packBlockingDisable(key: string, rarities: { key: string; active: boolean }[], packs: PackRates[]): string | null {
  const after = rarities.map((r) => (r.key === key ? { ...r, active: false } : r));
  const known = new Set(rarities.map((r) => r.key));
  const blocked = packs.find((p) => p.active && !Object.keys(activeRates((p.slot_rates ?? {}) as Record<string, number>, after)).some((k) => known.has(k)));
  return blocked?.name ?? null;
}

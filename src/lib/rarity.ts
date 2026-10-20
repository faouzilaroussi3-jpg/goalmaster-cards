import { useSyncExternalStore } from "react";

/** The 7 built-in rarities. Their keys double as the visual effects an admin-created rarity can borrow. */
export const RARITIES = [
  { key: "common", label: "Commune", short: "C", tier: 1 },
  { key: "uncommon", label: "Peu commune", short: "PC", tier: 2 },
  { key: "rare", label: "Rare", short: "R", tier: 3 },
  { key: "super_rare", label: "Super Rare", short: "SR", tier: 4 },
  { key: "legendary", label: "Légendaire", short: "L", tier: 5 },
  { key: "secret_legendary", label: "Secrète Légendaire", short: "SL", tier: 6 },
  { key: "secret_ultimate", label: "Secrète Ultime", short: "SU", tier: 7 },
] as const;

export type RarityKey = (typeof RARITIES)[number]["key"];

/** Extra looks an admin-created rarity can wear, each playing (duel cost, reveal, tier) like a built-in base rarity. Mirrors _effect_base in SQL. */
export const RARITY_STYLES = {
  vintage: "uncommon",
  watercolor: "uncommon",
  tinted: "rare",
  cartoon: "rare",
  torn: "rare",
  smoke: "rare",
  metal: "super_rare",
  neon: "super_rare",
  marble: "super_rare",
  electric: "super_rare",
  carbon: "super_rare",
  holo: "legendary",
  frost: "legendary",
  lava: "legendary",
  shattered: "legendary",
  galaxy: "secret_legendary",
} as const satisfies Record<string, RarityKey>;

export type RarityStyle = keyof typeof RARITY_STYLES;
/** Any value of rarities.effect: a built-in look or a style. */
export type RarityEffect = RarityKey | RarityStyle;

const isStyle = (k: string): k is RarityStyle => Object.prototype.hasOwnProperty.call(RARITY_STYLES, k);

/** Built-in rarity an effect plays like, or null for an unknown effect. */
export function effectBase(effect: string): RarityKey | null {
  if (isStyle(effect)) return RARITY_STYLES[effect];
  return RARITIES.some((r) => r.key === effect) ? (effect as RarityKey) : null;
}

/** True for any value rarities.effect accepts (built-in look or style). */
export function isEffect(k: string): k is RarityEffect {
  return effectBase(k) !== null;
}

/** Extra effects a rarity really draws: known, not the main one, no duplicates, never "common" (Simple doesn't mix). Mirrors _validate_rarity. */
export function cleanExtras(main: string, extras: readonly string[] | null | undefined): RarityEffect[] {
  if (main === "common") return [];
  const out: RarityEffect[] = [];
  for (const e of extras ?? []) if (isEffect(e) && e !== "common" && e !== main && !out.includes(e)) out.push(e);
  return out;
}

/** The style an effect draws on the card (null for the 7 built-in looks). */
export function effectStyle(effect: string): RarityStyle | null {
  return isStyle(effect) ? effect : null;
}

/**
 * A rarity as the UI sees it. `fx` is the built-in visual effect its cards wear (built-ins wear their own),
 * `tier` the visual intensity of that effect, `rank` its place from least to most rare, `color` an optional tint.
 */
export interface RarityInfo {
  key: string;
  label: string;
  short: string;
  tier: number;
  rank: number;
  fx: RarityKey;
  /** Built-in rarity it plays as (duels): built-ins keep their own key whatever look they wear. Mirrors _rarity_fx. */
  play: RarityKey;
  /** Extra look drawn instead of the base effect's frame (admin-created rarities only). */
  style: RarityStyle | null;
  /** Extra effects layered over the main look, in order (looks only: gameplay follows the main effect). */
  extras: RarityEffect[];
  color: string | null;
  builtin: boolean;
  /** Switched-off rarities no longer drop from packs (cards already owned are kept). */
  active: boolean;
}

/** Row shape of the rarities table. */
export interface RarityRow {
  key: string;
  label: string;
  short_label: string;
  tier: number;
  rank: number;
  effect: string;
  extra_effects?: string[] | null;
  color: string | null;
  builtin: boolean;
  active?: boolean;
}

const BUILTIN: RarityInfo[] = RARITIES.map((r) => ({ ...r, rank: r.tier, fx: r.key, play: r.key, style: null, extras: [], color: null, builtin: true, active: true }));
const isBuiltinKey = (k: string): k is RarityKey => RARITIES.some((r) => r.key === k);

let current: RarityInfo[] = BUILTIN;
const listeners = new Set<() => void>();

export function toRarityInfo(row: RarityRow): RarityInfo {
  const fx = effectBase(row.effect) ?? "common";
  return {
    key: row.key,
    label: row.label,
    short: row.short_label,
    tier: row.tier,
    rank: Number(row.rank),
    fx,
    play: row.builtin && isBuiltinKey(row.key) ? row.key : fx,
    style: effectStyle(row.effect),
    extras: cleanExtras(row.effect, row.extra_effects),
    color: row.color,
    builtin: row.builtin,
    active: row.active !== false,
  };
}

/** Replace the registry with the rarities loaded from the database (sorted least rare first). */
export function setRarities(rows: RarityRow[]) {
  if (!rows.length) return;
  current = rows.map(toRarityInfo).sort((a, b) => a.rank - b.rank);
  listeners.forEach((l) => l());
}

export function getRarities(): RarityInfo[] {
  return current;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** All rarities, least rare first; re-renders when an admin adds, edits or removes one. */
export function useRarities(): RarityInfo[] {
  return useSyncExternalStore(subscribe, getRarities, () => BUILTIN);
}

export function rarityMeta(key: string): RarityInfo {
  return current.find((r) => r.key === key) ?? BUILTIN.find((r) => r.key === key) ?? { key, label: key, short: "?", tier: 0, rank: 0, fx: "common", play: "common", style: null, extras: [], color: null, builtin: false, active: true };
}

/** Reactive rarityMeta for components that render cards. */
export function useRarityMeta(key: string): RarityInfo {
  const list = useRarities();
  return list.find((r) => r.key === key) ?? rarityMeta(key);
}

export const VERSION_LABEL: Record<string, string> = { normal: "Normale", alt: "ALT", shiny: "Shiny" };

export interface CardData {
  id?: string;
  card_id?: string;
  name: string;
  club: string;
  nationality: string;
  pos: string;
  rating: number;
  rarity: string;
  image_url?: string | null;
  alt_image_url?: string | null;
  version?: string;
}

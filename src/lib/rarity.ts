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
  color: string | null;
  builtin: boolean;
}

/** Row shape of the rarities table. */
export interface RarityRow {
  key: string;
  label: string;
  short_label: string;
  tier: number;
  rank: number;
  effect: string;
  color: string | null;
  builtin: boolean;
}

const BUILTIN: RarityInfo[] = RARITIES.map((r) => ({ ...r, rank: r.tier, fx: r.key, color: null, builtin: true }));
const isFx = (k: string): k is RarityKey => RARITIES.some((r) => r.key === k);

let current: RarityInfo[] = BUILTIN;
const listeners = new Set<() => void>();

export function toRarityInfo(row: RarityRow): RarityInfo {
  return {
    key: row.key,
    label: row.label,
    short: row.short_label,
    tier: row.tier,
    rank: Number(row.rank),
    fx: isFx(row.effect) ? row.effect : "common",
    color: row.color,
    builtin: row.builtin,
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

/** All rarities, least rare first; re-renders when an admin adds or removes one. */
export function useRarities(): RarityInfo[] {
  return useSyncExternalStore(subscribe, getRarities, () => BUILTIN);
}

export function rarityMeta(key: string): RarityInfo {
  return current.find((r) => r.key === key) ?? BUILTIN.find((r) => r.key === key) ?? { key, label: key, short: "?", tier: 0, rank: 0, fx: "common", color: null, builtin: false };
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

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

export function rarityMeta(key: string) {
  return RARITIES.find((r) => r.key === key) ?? { key, label: key, short: "?", tier: 0 };
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

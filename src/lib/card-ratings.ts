// Rating bands for player cards from Commune to Super Rare.
// Rarity and rating follow the player's real level: a rarer card is never rated below a less rare one.
export const RATING_BANDS = {
  common: [60, 69],
  uncommon: [70, 74],
  rare: [75, 80],
  super_rare: [81, 88],
} as const satisfies Record<string, readonly [number, number]>;

export type BandRarity = keyof typeof RATING_BANDS;

/** Rarity whose band contains this rating (null outside Commune–Super Rare). */
export function rarityForRating(rating: number): BandRarity | null {
  for (const [rarity, [lo, hi]] of Object.entries(RATING_BANDS) as [BandRarity, readonly [number, number]][]) {
    if (rating >= lo && rating <= hi) return rarity;
  }
  return null;
}

/** True when the rating sits inside the band of its rarity (rarities above Super Rare are not banded). */
export function ratingFitsRarity(rarity: string, rating: number): boolean {
  const band = RATING_BANDS[rarity as BandRarity];
  return !band || (rating >= band[0] && rating <= band[1]);
}

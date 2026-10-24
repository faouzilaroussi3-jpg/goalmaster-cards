import { describe, expect, it } from "vitest";
import { RATING_BANDS, rarityForRating, ratingFitsRarity } from "@/lib/card-ratings";
import first from "@/data/catalog-expansion.json";
import second from "@/data/catalog-expansion-2500.json";
import { CATALOG_EDITIONS } from "@/lib/catalog-editions";

const ALL = [...first, ...second, ...CATALOG_EDITIONS].filter((c) => c.rarity in RATING_BANDS);

describe("Commune to Super Rare ratings", () => {
  it("uses bands C 60-69, PC 70-74, R 75-80, SR 81-88", () => {
    expect(RATING_BANDS).toEqual({ common: [60, 69], uncommon: [70, 74], rare: [75, 80], super_rare: [81, 88] });
  });

  it("maps a rating to exactly one rarity at the band edges", () => {
    expect(rarityForRating(69)).toBe("common");
    expect(rarityForRating(70)).toBe("uncommon");
    expect(rarityForRating(74)).toBe("uncommon");
    expect(rarityForRating(75)).toBe("rare");
    expect(rarityForRating(80)).toBe("rare");
    expect(rarityForRating(81)).toBe("super_rare");
    expect(rarityForRating(89)).toBeNull();
  });

  it("keeps every catalog card inside the band of its rarity", () => {
    expect(ALL.length).toBeGreaterThan(3000);
    for (const c of ALL) expect(ratingFitsRarity(c.rarity, c.rating), `${c.name} ${c.rarity} ${c.rating}`).toBe(true);
  });

  it("never rates a rarer card below a less rare one", () => {
    const order = ["common", "uncommon", "rare", "super_rare"] as const;
    for (let i = 1; i < order.length; i++) {
      const lowerMax = Math.max(...ALL.filter((c) => c.rarity === order[i - 1]).map((c) => c.rating));
      const upperMin = Math.min(...ALL.filter((c) => c.rarity === order[i]).map((c) => c.rating));
      expect(upperMin, order[i]).toBeGreaterThan(lowerMax);
    }
  });
});

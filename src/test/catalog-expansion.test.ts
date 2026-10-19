import { describe, expect, it } from "vitest";
import expansion from "@/data/catalog-expansion.json";

const RANGE: Record<string, [number, number]> = {
  common: [60, 69],
  uncommon: [70, 75],
  rare: [76, 81],
  super_rare: [82, 88],
};

describe("500-card expansion", () => {
  it("adds exactly 500 cards", () => {
    expect(expansion).toHaveLength(500);
  });

  it("only uses Commune to Super Rare", () => {
    expect(new Set(expansion.map((c) => c.rarity))).toEqual(new Set(["common", "uncommon", "rare", "super_rare"]));
  });

  it("keeps ratings inside each rarity band, so stronger players sit in rarer tiers", () => {
    for (const c of expansion) {
      const [lo, hi] = RANGE[c.rarity]!;
      expect(c.rating, c.name).toBeGreaterThanOrEqual(lo);
      expect(c.rating, c.name).toBeLessThanOrEqual(hi);
    }
  });

  it("gives every card its own credited photograph", () => {
    expect(new Set(expansion.map((c) => c.image_url)).size).toBe(500);
    for (const c of expansion) {
      expect(c.photo_source, c.name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(c.photo_license, c.name).toBeTruthy();
    }
  });
});

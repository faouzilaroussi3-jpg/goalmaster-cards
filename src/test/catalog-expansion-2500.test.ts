import { describe, expect, it } from "vitest";
import expansion from "@/data/catalog-expansion-2500.json";
import first from "@/data/catalog-expansion.json";

const RANGE: Record<string, [number, number]> = {
  common: [60, 69],
  uncommon: [70, 75],
  rare: [76, 81],
};

describe("2 500-card expansion", () => {
  it("adds exactly 2 500 cards", () => {
    expect(expansion).toHaveLength(2500);
  });

  it("only uses Commune, Peu commune and Rare", () => {
    expect(new Set(expansion.map((c) => c.rarity))).toEqual(new Set(["common", "uncommon", "rare"]));
  });

  it("keeps ratings inside each rarity band", () => {
    for (const c of expansion) {
      const [lo, hi] = RANGE[c.rarity]!;
      expect(c.rating, c.name).toBeGreaterThanOrEqual(lo);
      expect(c.rating, c.name).toBeLessThanOrEqual(hi);
    }
  });

  it("gives every card its own credited photo, distinct from the first expansion", () => {
    const urls = new Set(expansion.map((c) => c.image_url));
    expect(urls.size).toBe(2500);
    for (const c of first) expect(urls.has(c.image_url), c.name).toBe(false);
    for (const c of expansion) {
      expect(c.photo_source, c.name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(c.photo_license, c.name).toBeTruthy();
    }
  });

  it("never repeats a player", () => {
    expect(new Set(expansion.map((c) => c.wikidata)).size).toBe(2500);
  });
});

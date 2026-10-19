import { describe, expect, it } from "vitest";
import { CATALOG_EDITIONS } from "@/lib/catalog-editions";

describe("Player edition eligibility", () => {
  it("keeps renowned stars out of common, uncommon and rare packs", () => {
    const stars = new Set(CATALOG_EDITIONS.filter((c) => ["super_rare", "legendary", "secret_legendary", "secret_ultimate"].includes(c.rarity)).map((c) => c.name));
    const lower = CATALOG_EDITIONS.filter((c) => ["common", "uncommon", "rare"].includes(c.rarity));
    expect(lower).toHaveLength(27);
    expect(lower.filter((c) => stars.has(c.name))).toEqual([]);
    expect(Math.max(...lower.map((c) => c.rating))).toBeLessThan(Math.min(...CATALOG_EDITIONS.filter((c) => c.rarity === "super_rare").map((c) => c.rating)));
  });

  it("offers Haaland as both Super Rare and Legendary with distinct photographs", () => {
    const haaland = CATALOG_EDITIONS.filter((c) => c.name === "Erling Haaland");
    expect(haaland.map((c) => c.rarity)).toEqual(["super_rare", "legendary", "secret_ultimate"]);
    expect(new Set(haaland.map((c) => c.image_url)).size).toBe(3);
    expect(haaland[1]?.rating).toBeGreaterThan(haaland[0]?.rating ?? 0);
  });

  it("gives each repeated star a different photograph for each rarity edition", () => {
    for (const name of new Set(CATALOG_EDITIONS.map((c) => c.name))) {
      const editions = CATALOG_EDITIONS.filter((c) => c.name === name);
      expect(new Set(editions.map((c) => c.image_url)).size, name).toBe(editions.length);
    }
  });

  it("gives every Legendary ALT a different photo of the same player", () => {
    const legendaries = CATALOG_EDITIONS.filter((c) => c.rarity === "legendary");
    expect(legendaries.length).toBeGreaterThan(0);
    for (const card of legendaries) {
      const alt = "alt_image_url" in card ? card.alt_image_url : undefined;
      expect(alt, card.name).toBeTruthy();
      // A different real photo: never reuses any other edition's picture of the same player.
      const otherPhotos = CATALOG_EDITIONS.filter((c) => c.name === card.name).map((c) => c.image_url as string);
      expect(otherPhotos, card.name).not.toContain(alt);
    }
  });

  it("uses a dedicated illustration for every Secret Ultimate edition", () => {
    const ultimates = CATALOG_EDITIONS.filter((c) => c.rarity === "secret_ultimate");
    expect(ultimates.map((c) => c.name)).toEqual(["Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappé", "Erling Haaland"]);
    const otherArt = new Set<string>(CATALOG_EDITIONS.filter((c) => c.rarity !== "secret_ultimate").map((c) => c.image_url));
    for (const card of ultimates) expect(otherArt.has(card.image_url), card.name).toBe(false);
  });
});

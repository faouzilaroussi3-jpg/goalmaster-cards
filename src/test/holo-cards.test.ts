import { describe, expect, it } from "vitest";
import holo from "@/data/holo-cards.json";

describe("Holographique expansion", () => {
  it("adds 30 Holographique star cards, one per player", () => {
    expect(holo).toHaveLength(30);
    expect(holo.every((c) => c.rarity === "custom_ad6715e6c9")).toBe(true);
    expect(new Set(holo.map((c) => c.name)).size).toBe(30);
    expect(holo.map((c) => c.name)).not.toContain("Désiré Doué");
  });

  it("gives every card its own credited photo", () => {
    expect(new Set(holo.map((c) => c.image_url)).size).toBe(30);
    for (const c of holo) {
      expect(c.photo_author, c.name).toBeTruthy();
      expect(c.photo_source, c.name).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });
});

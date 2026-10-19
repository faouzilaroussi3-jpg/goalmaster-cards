import { describe, expect, it } from "vitest";
import { rareFx, revealTiming } from "@/lib/rare-reveal";

const card = (rarity: string, tier: number, version = "normal") => ({ rarity, tier, version, is_bonus: false });

describe("rare reveal animation", () => {
  it("plays from Légendaire upwards, matching each card's effect", () => {
    expect(rareFx("super_rare")).toBeNull();
    expect(rareFx("legendary")).toBe("legendary");
    expect(rareFx("legendary", "alt")).toBe("alt");
    expect(rareFx("secret_legendary")).toBe("secret_legendary");
    expect(rareFx("secret_legendary", "shiny")).toBe("shiny");
    expect(rareFx("secret_ultimate")).toBe("secret_ultimate");
  });

  it("lasts at least 3 seconds for every Légendaire-or-better card", () => {
    for (const c of [card("legendary", 5), card("legendary", 5, "alt"), card("secret_legendary", 6), card("secret_legendary", 6, "shiny"), card("secret_ultimate", 7)]) {
      const t = revealTiming(c);
      expect(t.total, c.rarity + c.version).toBeGreaterThanOrEqual(3000);
      expect(t.lock, c.rarity + c.version).toBeGreaterThanOrEqual(3000);
    }
  });

  it("does not slow down cards below Légendaire", () => {
    expect(revealTiming(card("super_rare", 4)).lock).toBeLessThan(1500);
    expect(revealTiming(card("common", 1)).total).toBe(0);
  });
});

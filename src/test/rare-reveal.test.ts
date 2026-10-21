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

describe("rarities above Légendaire", () => {
  it("every rarity ranked Légendaire or higher gets a big reveal, whatever look it wears", async () => {
    const { setRarities } = await import("@/lib/rarity");
    const { rarityRevealFx } = await import("@/lib/rare-reveal");
    const row = (key: string, rank: number, effect: string, builtin = false) => ({ key, label: key, short_label: key, tier: 3, rank, effect, color: null, builtin });
    setRarities([
      row("common", 1, "common", true), row("super_rare", 4, "super_rare", true), row("legendary", 5, "legendary", true),
      row("secret_legendary", 6, "neon", true), row("secret_ultimate", 7, "vintage", true),
      row("custom_low", 4.5, "cartoon"), row("custom_mid", 5.5, "cartoon"), row("custom_high", 6.5, "vintage"), row("custom_top", 8, "tinted"),
    ]);
    expect(rarityRevealFx("custom_low")).toBeNull();
    expect(rarityRevealFx("custom_mid")).toBe("legendary");
    expect(rarityRevealFx("custom_high")).toBe("secret_legendary");
    expect(rarityRevealFx("custom_high", "shiny")).toBe("shiny");
    expect(rarityRevealFx("custom_top")).toBe("secret_ultimate");
    // Built-ins wearing another look keep their own reveal.
    expect(rarityRevealFx("secret_legendary")).toBe("secret_legendary");
    expect(rarityRevealFx("secret_ultimate")).toBe("secret_ultimate");
    expect(revealTiming({ rarity: "custom_mid", version: "normal", tier: 3, is_bonus: false }).total).toBeGreaterThanOrEqual(3000);
  });
});

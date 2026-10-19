import { afterEach, describe, expect, it } from "vitest";
import { canDeleteRarity, rankAfter, rarityDraftError } from "@/lib/rarity-admin";
import { RARITIES, RARITY_STYLES, effectBase, rarityMeta, setRarities, type RarityRow } from "@/lib/rarity";
import { RARITY_EFFECTS } from "@/lib/rarity-admin";
import { rarityEffects } from "@/lib/card-photo";

const ok = { label: "Mythique", short: "M", effect: "legendary", color: "#ff3366", duplicateCoins: 200 };

describe("admin-created rarities", () => {
  afterEach(() => setRarities(RARITIES.map((r) => ({ key: r.key, label: r.label, short_label: r.short, tier: r.tier, rank: r.tier, effect: r.key, color: null, builtin: true }))));

  it("accepts a valid new rarity", () => {
    expect(rarityDraftError(ok)).toBeNull();
    expect(rarityDraftError({ ...ok, color: "" })).toBeNull();
  });

  it("rejects names over 30 characters, sigles over 4, unknown effects and bad colours", () => {
    expect(rarityDraftError({ ...ok, label: "x".repeat(31) })).not.toBeNull();
    expect(rarityDraftError({ ...ok, short: "ABCDE" })).not.toBeNull();
    expect(rarityDraftError({ ...ok, effect: "rainbow" })).not.toBeNull();
    expect(rarityDraftError({ ...ok, color: "red" })).not.toBeNull();
    expect(rarityDraftError({ ...ok, duplicateCoins: 100_001 })).not.toBeNull();
  });

  it("slots a new rarity between its neighbours, or after the rarest", () => {
    expect(rankAfter(3, 4)).toBe(3.5);
    expect(rankAfter(7, null)).toBe(8);
  });

  it("never deletes the built-in rarities and needs somewhere to move the cards", () => {
    expect(canDeleteRarity({ key: "legendary", builtin: true }, "rare")).toBe(false);
    expect(canDeleteRarity({ key: "custom_1", builtin: false }, null)).toBe(false);
    expect(canDeleteRarity({ key: "custom_1", builtin: false }, "custom_1")).toBe(false);
    expect(canDeleteRarity({ key: "custom_1", builtin: false }, "rare")).toBe(true);
  });

  it("cards of a new rarity wear the visual effect chosen for it", () => {
    const row: RarityRow = { key: "custom_1", label: "Mythique", short_label: "M", tier: 5, rank: 5.5, effect: "secret_legendary", color: "#ff3366", builtin: false };
    setRarities([row]);
    expect(rarityMeta("custom_1").fx).toBe("secret_legendary");
    expect(rarityMeta("custom_1").color).toBe("#ff3366");
  });

  it("offers 8 extra looks on top of the 7 built-in ones", () => {
    expect(RARITY_EFFECTS).toHaveLength(15);
    expect(RARITY_EFFECTS.filter((e) => e.isNew).map((e) => e.fx).sort()).toEqual(["cartoon", "frost", "galaxy", "holo", "metal", "neon", "tinted", "vintage"]);
    expect(rarityDraftError({ ...ok, effect: "metal" })).toBeNull();
    expect(rarityDraftError({ ...ok, effect: "cartoon" })).toBeNull();
  });

  it("each extra look plays like the same base rarity as _effect_base in the database", () => {
    expect(RARITY_STYLES).toEqual({ vintage: "uncommon", tinted: "rare", cartoon: "rare", metal: "super_rare", neon: "super_rare", holo: "legendary", frost: "legendary", galaxy: "secret_legendary" });
    expect(effectBase("legendary")).toBe("legendary");
    expect(effectBase("glitter")).toBeNull();
  });

  it("cards of a rarity with an extra look draw that look and list its effects", () => {
    setRarities([{ key: "custom_2", label: "Chrome", short_label: "CH", tier: 4, rank: 4.5, effect: "metal", color: null, builtin: false }]);
    expect(rarityMeta("custom_2").style).toBe("metal");
    expect(rarityMeta("custom_2").fx).toBe("super_rare");
    expect(rarityEffects("custom_2")).toContain("Chrome brossé");
  });
});

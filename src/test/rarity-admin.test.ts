import { afterEach, describe, expect, it } from "vitest";
import { canDeleteRarity, rankAfter, rarityDraftError } from "@/lib/rarity-admin";
import { RARITIES, rarityMeta, setRarities, type RarityRow } from "@/lib/rarity";

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
});

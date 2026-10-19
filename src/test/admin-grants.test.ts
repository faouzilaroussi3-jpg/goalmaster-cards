import { describe, expect, it } from "vitest";
import { giftError, giftSummary, type GiftForm } from "@/lib/admin-grants";

const f = (o: Partial<GiftForm>): GiftForm => ({
  allPlayers: false, userId: "u1", packKey: "classic", packs: 0, coins: 0, cardId: null, version: "normal", copies: 0, note: "", ...o,
});
const card = { has_alt: true, has_shiny: false };

describe("admin gift rules", () => {
  it("needs a player unless sending to everyone", () => {
    expect(giftError(f({ userId: null, coins: 10 }))).toBe("Choisis un joueur");
    expect(giftError(f({ userId: null, allPlayers: true, coins: 10 }))).toBeNull();
  });
  it("refuses an empty gift", () => {
    expect(giftError(f({}))).toBe("Rien à envoyer");
  });
  it("allows up to 10 000 packs per send but not 10 001", () => {
    expect(giftError(f({ packs: 10_000 }))).toBeNull();
    expect(giftError(f({ packs: 10_001 }))).not.toBeNull();
  });
  it("allows up to 100 000 000 coins per send but not more", () => {
    expect(giftError(f({ coins: 100_000_000 }))).toBeNull();
    expect(giftError(f({ coins: 100_000_001 }))).not.toBeNull();
  });
  it("refuses negative amounts", () => {
    expect(giftError(f({ coins: -5 }))).not.toBeNull();
  });
  it("only gives an ALT or Shiny copy when the card has that version", () => {
    expect(giftError(f({ cardId: "c", copies: 1, version: "alt" }), card)).toBeNull();
    expect(giftError(f({ cardId: "c", copies: 1, version: "shiny" }), card)).toBe("Cette carte n'a pas de version Shiny");
  });
  it("summarises a gift in French", () => {
    expect(giftSummary({ pack_name: "Premium", packs: 3, coins: 1, card_name: "Mbappé", card_version: "alt", card_copies: 2 }))
      .toBe("3 packs Premium · 1 pièce · 2× Mbappé ALT");
  });
});

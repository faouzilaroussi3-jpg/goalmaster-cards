import { describe, expect, it } from "vitest";
import { cardPower, deckCost, deckProblem, duelPayout, eloDelta, isDecided } from "@/lib/duel";

describe("duel rules", () => {
  it("a player in the right position for the round gets +6", () => {
    expect(cardPower({ pos: "BU", rarity: "common", rating: 65 }, "attaque")).toBe(71);
    expect(cardPower({ pos: "BU", rarity: "common", rating: 65 }, "defense")).toBe(65);
  });

  it("a goalkeeper is +6 in the goalkeeper round and −6 elsewhere, outfield players −6 in goal", () => {
    expect(cardPower({ pos: "G", rarity: "common", rating: 65 }, "gardien")).toBe(71);
    expect(cardPower({ pos: "G", rarity: "common", rating: 65 }, "milieu")).toBe(59);
    expect(cardPower({ pos: "MC", rarity: "common", rating: 65 }, "gardien")).toBe(59);
  });

  it("rarity adds up to +5, ALT/Shiny +2, club cards +2 in every round", () => {
    expect(cardPower({ pos: "MC", rarity: "secret_legendary", version: "shiny", rating: 90 }, "libre")).toBe(97);
    expect(cardPower({ pos: "CLUB", rarity: "legendary", version: "normal", rating: 90 }, "gardien")).toBe(96);
  });

  it("a team costs C1 PC2 R3 SR4 L6 SL8 and must fit in 20 points", () => {
    const team = ["legendary", "super_rare", "super_rare", "rare", "rare"].map((rarity, i) => ({ rarity, card_id: String(i) }));
    expect(deckCost(team)).toBe(20);
    expect(deckProblem(team)).toBeNull();
    const tooRich = ["secret_legendary", "legendary", "super_rare", "rare", "common"].map((rarity, i) => ({ rarity, card_id: String(i) }));
    expect(deckProblem(tooRich)).not.toBeNull();
  });

  it("a team needs 5 different players", () => {
    const dup = ["common", "common", "common", "common", "common"].map((rarity, i) => ({ rarity, card_id: i < 2 ? "same" : String(i) }));
    expect(deckProblem(dup)).not.toBeNull();
    expect(deckProblem(dup.slice(0, 4))).not.toBeNull();
  });

  it("the duel ends early when the trailing player cannot catch up", () => {
    expect(isDecided(3, 0, 3)).toBe(true);
    expect(isDecided(2, 0, 3)).toBe(false);
    expect(isDecided(2, 2, 5)).toBe(true);
  });

  it("pays 100 for a win, 40 for a draw, 20 for a loss, 0 when you abandon", () => {
    expect(duelPayout(1, false)).toBe(100);
    expect(duelPayout(0.5, false)).toBe(40);
    expect(duelPayout(0, false)).toBe(20);
    expect(duelPayout(0, true)).toBe(0);
  });

  it("Elo moves 16 points between equal players", () => {
    expect(eloDelta(1000, 1000, 1)).toBe(16);
    expect(eloDelta(1000, 1000, 0)).toBe(-16);
  });
});

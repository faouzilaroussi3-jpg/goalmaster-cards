import { describe, expect, it } from "vitest";
import { openingCinematic } from "@/lib/opening-cinematic";

describe("Opening football action", () => {
  it("uses the rarest actual card, including a bonus, to choose the action", () => {
    expect(openingCinematic([{ tier: 1 }, { tier: 5 }])).toEqual({ tier: 5, action: "bicycle", duration: 4800 });
  });
  it("escalates from dribbling to a shot, volley and bicycle kick", () => {
    expect([1, 3, 4, 5].map((tier) => openingCinematic([{ tier }]).action)).toEqual(["dribble", "shot", "volley", "bicycle"]);
  });
  it("preserves the separate intensity of the secret rarities", () => {
    expect(openingCinematic([{ tier: 6 }]).tier).toBe(6);
    expect(openingCinematic([{ tier: 7 }]).tier).toBe(7);
  });
});
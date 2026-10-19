import { describe, expect, it } from "vitest";
import { challengeState, claimableSummary, newlyClaimable, type Challenge } from "@/lib/challenges";

const ch = (o: Partial<Challenge>): Challenge => ({
  challenge_id: o.key ?? "x", key: "x", title: "t", metric: "rarity", rarity: "common", version: null,
  target: 10, reward_coins: 50, secret: false, sort_order: 0, progress: 0, claimed: false, ...o,
});

describe("challenges", () => {
  it("a challenge can be claimed only once the card count reaches the target", () => {
    expect(challengeState(ch({ progress: 9, target: 10 }))).toBe("in_progress");
    expect(challengeState(ch({ progress: 10, target: 10 }))).toBe("claimable");
    expect(challengeState(ch({ progress: 25, target: 10 }))).toBe("claimable");
  });

  it("a claimed challenge cannot pay out again", () => {
    expect(challengeState(ch({ progress: 50, target: 10, claimed: true }))).toBe("claimed");
  });

  it("sums the coins of every reward waiting to be collected", () => {
    const list = [
      ch({ key: "a", progress: 10, target: 10, reward_coins: 50 }),
      ch({ key: "b", progress: 1, target: 1, reward_coins: 300 }),
      ch({ key: "c", progress: 3, target: 10, reward_coins: 150 }),
      ch({ key: "d", progress: 10, target: 10, reward_coins: 999, claimed: true }),
    ];
    expect(claimableSummary(list)).toEqual({ count: 2, coins: 350 });
  });

  it("announces only the challenges a pack just completed", () => {
    const before = [ch({ key: "a", progress: 10 }), ch({ key: "b", progress: 8 })];
    const after = [ch({ key: "a", progress: 13 }), ch({ key: "b", progress: 11 })];
    expect(newlyClaimable(before, after).map((c) => c.key)).toEqual(["b"]);
  });

});

import { describe, expect, it } from "vitest";
import { periodicSummary, timeLeft, type PeriodicChallenge } from "@/lib/periodic-challenges";
import { newlyClaimable } from "@/lib/challenges";

const pc = (o: Partial<PeriodicChallenge>): PeriodicChallenge => ({
  challenge_id: o.key ?? "x", key: "x", period: "daily", title: "t", metric: "packs", rarity: null, version: null,
  target: 3, reward_coins: 100, reward_pack_key: "classic", reward_pack_name: "Pack Classique", reward_packs: 1,
  progress: 0, claimed: false, ends_at: "2026-10-21T22:00:00Z", ...o,
});

describe("daily and weekly challenges", () => {
  it("rewards both packs and coins once completed", () => {
    const list = [
      pc({ key: "a", progress: 3, target: 3, reward_coins: 100, reward_packs: 1 }),
      pc({ key: "b", period: "weekly", progress: 20, target: 20, reward_coins: 500, reward_pack_key: "premium", reward_pack_name: "Pack Premium", reward_packs: 1 }),
      pc({ key: "c", progress: 2, target: 3, reward_coins: 150, reward_packs: 1 }),
      pc({ key: "d", progress: 5, target: 3, reward_coins: 999, reward_packs: 9, claimed: true }),
    ];
    expect(periodicSummary(list)).toEqual({
      count: 2, coins: 600, packs: { "Pack Classique": 1, "Pack Premium": 1 }, packCount: 2,
    });
  });

  it("a challenge with only a coin reward adds no pack", () => {
    const s = periodicSummary([pc({ progress: 1, target: 1, reward_coins: 200, reward_packs: 0, reward_pack_key: null, reward_pack_name: null })]);
    expect(s.coins).toBe(200);
    expect(s.packCount).toBe(0);
  });

  it("shows the time left before the challenges are replaced", () => {
    const now = Date.parse("2026-10-21T10:00:00Z");
    expect(timeLeft("2026-10-21T22:00:00Z", now)).toBe("12 h");
    expect(timeLeft("2026-10-21T15:12:00Z", now)).toBe("5 h 12 min");
    expect(timeLeft("2026-10-24T14:00:00Z", now)).toBe("3 j 4 h");
    expect(timeLeft("2026-10-21T09:00:00Z", now)).toBe("maintenant");
  });

  it("announces a daily challenge a pack just completed", () => {
    const before = [pc({ key: "a", progress: 2, target: 3 })];
    const after = [pc({ key: "a", progress: 3, target: 3 })];
    expect(newlyClaimable(before, after).map((c) => c.key)).toEqual(["a"]);
  });
});

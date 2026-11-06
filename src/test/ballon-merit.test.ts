import { describe, expect, it } from "vitest";
import type { PlayerStats } from "@/lib/admin-stats";
import { MERIT_MAX, meritRaw, rankMerit } from "@/lib/ballon-merit";

const base: PlayerStats = {
  user_id: "", username: "", level: 1, xp: 0, coins: 0, joined_at: "", is_admin: false,
  packs_opened: 0, cards_pulled: 0, rare_pulled: 0, legendary_pulled: 0, cards_owned: 0, unique_owned: 0, rare_owned: 0,
  duel_wins: 0, duel_losses: 0, duel_draws: 0, duel_rating: 1000,
  tactic_wins: 0, tactic_losses: 0, tactic_draws: 0, goals_for: 0, goals_against: 0, match_rating: 1000,
  live_wins: 0, live_losses: 0, live_draws: 0, auctions_sold: 0, ballon_dor: 0, challenges_claimed: 0,
};
const p = (username: string, o: Partial<PlayerStats>): PlayerStats => ({ ...base, user_id: username, username, ...o });

describe("qui mérite le Ballon d'Or", () => {
  it("pulls give 1 per pack, 3 per rare and 15 per legendary; wins 3 and draws 1", () => {
    const r = meritRaw(p("a", { packs_opened: 10, rare_pulled: 4, legendary_pulled: 1, duel_wins: 2, duel_draws: 1, tactic_wins: 1, live_wins: 1, live_draws: 2 }));
    expect(r.pulls).toBe(10 + 12 + 15);
    expect(r.duels).toBe(7);
    expect(r.matches).toBe(8);
  });

  it("the leader of every domain scores the maximum", () => {
    const [top] = rankMerit([p("a", { packs_opened: 5, unique_owned: 9, duel_wins: 2, tactic_wins: 1, challenges_claimed: 3, xp: 50, auctions_sold: 1, quiz_points: 20 }), p("b", { packs_opened: 1 })]);
    expect(top?.player.username).toBe("a");
    expect(top?.total).toBe(MERIT_MAX);
  });

  it("every domain weighs the same: being good everywhere beats spamming packs", () => {
    const rows = [p("spam", { packs_opened: 1000 }), p("allround", { packs_opened: 100, duel_wins: 5, tactic_wins: 5 })];
    expect(rankMerit(rows).map((r) => r.player.username)).toEqual(["allround", "spam"]);
  });

  it("players who did nothing are left out", () => {
    expect(rankMerit([p("a", { xp: 10 }), p("b", {})]).map((r) => r.player.username)).toEqual(["a"]);
  });
});

import { describe, expect, it } from "vitest";
import { matchRecord, rankBoard, winRate, type PlayerStats } from "@/lib/admin-stats";

const base: PlayerStats = {
  user_id: "", username: "", level: 1, xp: 0, coins: 0, joined_at: "", is_admin: false,
  packs_opened: 0, cards_pulled: 0, rare_pulled: 0, legendary_pulled: 0, cards_owned: 0, unique_owned: 0, rare_owned: 0,
  duel_wins: 0, duel_losses: 0, duel_draws: 0, duel_rating: 1000,
  tactic_wins: 0, tactic_losses: 0, tactic_draws: 0, goals_for: 0, goals_against: 0, match_rating: 1000,
  live_wins: 0, live_losses: 0, live_draws: 0, auctions_sold: 0, ballon_dor: 0, challenges_claimed: 0,
};
const p = (username: string, o: Partial<PlayerStats>): PlayerStats => ({ ...base, user_id: username, username, ...o });

describe("admin player rankings", () => {
  it("match wins add tactical and hand-steered games", () => {
    expect(matchRecord(p("a", { tactic_wins: 2, live_wins: 3, live_losses: 1 }))).toEqual({ wins: 5, losses: 1, draws: 0, played: 6 });
  });

  it("rare board ranks by rare cards pulled, most first", () => {
    const rows = [p("a", { rare_pulled: 4 }), p("b", { rare_pulled: 9 }), p("c", { rare_pulled: 6 })];
    expect(rankBoard(rows, "rare").map((r) => r.player.username)).toEqual(["b", "c", "a"]);
  });

  it("duel board ranks by duel wins and breaks ties on win rate", () => {
    const rows = [p("a", { duel_wins: 5, duel_losses: 5 }), p("b", { duel_wins: 5, duel_losses: 1 }), p("c", { duel_wins: 7 })];
    expect(rankBoard(rows, "duels").map((r) => [r.place, r.player.username])).toEqual([[1, "c"], [2, "b"], [3, "a"]]);
  });

  it("match board leaves out players without a win", () => {
    const rows = [p("a", { live_wins: 1 }), p("b", { tactic_losses: 3 })];
    expect(rankBoard(rows, "matches").map((r) => r.player.username)).toEqual(["a"]);
  });

  it("win rate is 0 when nothing was played", () => {
    expect(winRate({ wins: 0, played: 0 })).toBe(0);
    expect(winRate({ wins: 2, played: 3 })).toBe(67);
  });
});

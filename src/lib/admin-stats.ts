/** Row returned by admin_player_stats (admin only). */
export interface PlayerStats {
  user_id: string;
  username: string;
  level: number;
  xp: number;
  coins: number;
  joined_at: string;
  is_admin: boolean;
  packs_opened: number;
  cards_pulled: number;
  rare_pulled: number;
  legendary_pulled: number;
  cards_owned: number;
  unique_owned: number;
  rare_owned: number;
  duel_wins: number;
  duel_losses: number;
  duel_draws: number;
  duel_rating: number;
  tactic_wins: number;
  tactic_losses: number;
  tactic_draws: number;
  goals_for: number;
  goals_against: number;
  match_rating: number;
  live_wins: number;
  live_losses: number;
  live_draws: number;
  auctions_sold: number;
  ballon_dor: number;
  challenges_claimed: number;
}

/** Matches = tactical 11v11 games + games steered by hand (vs bot or friend). */
export function matchRecord(s: PlayerStats) {
  const wins = Number(s.tactic_wins) + Number(s.live_wins);
  const losses = Number(s.tactic_losses) + Number(s.live_losses);
  const draws = Number(s.tactic_draws) + Number(s.live_draws);
  return { wins, losses, draws, played: wins + losses + draws };
}

export function duelRecord(s: PlayerStats) {
  const wins = Number(s.duel_wins), losses = Number(s.duel_losses), draws = Number(s.duel_draws);
  return { wins, losses, draws, played: wins + losses + draws };
}

/** Win rate in whole percent, 0 when nothing was played. */
export function winRate(r: { wins: number; played: number }): number {
  return r.played > 0 ? Math.round((r.wins / r.played) * 100) : 0;
}

export type Board = "rare" | "duels" | "matches";

/** The value a ranking sorts by: rare cards pulled from packs, duel wins, match wins. */
export function boardValue(s: PlayerStats, board: Board): number {
  if (board === "rare") return Number(s.rare_pulled);
  if (board === "duels") return Number(s.duel_wins);
  return matchRecord(s).wins;
}

/**
 * Ranking for one board: highest value first, players at 0 left out.
 * Ties go to the better record (higher win rate / more legendaries), then the name.
 */
export function rankBoard(rows: PlayerStats[], board: Board, limit = 10) {
  const tie = (s: PlayerStats) =>
    board === "rare" ? Number(s.legendary_pulled) : board === "duels" ? winRate(duelRecord(s)) : winRate(matchRecord(s));
  return rows
    .map((s) => ({ s, value: boardValue(s, board), tie: tie(s) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || b.tie - a.tie || a.s.username.localeCompare(b.s.username, "fr"))
    .slice(0, limit)
    .map((r, i) => ({ place: i + 1, player: r.s, value: r.value }));
}

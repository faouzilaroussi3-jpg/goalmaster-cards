import { duelRecord, matchRecord, type PlayerStats } from "@/lib/admin-stats";

/**
 * "Qui mérite le Ballon d'Or" (admin only): everything a player has achieved, all time.
 * Each domain gets raw points, then is scored out of 100 against the best player in that
 * domain, so every domain weighs the same and spamming one activity cannot win alone.
 */
export const MERIT_DOMAINS = [
  { key: "pulls", label: "Tirages", hint: "1 pt par pack, +3 par carte Rare+ tirée, +15 par Légendaire+" },
  { key: "collection", label: "Collection", hint: "1 pt par carte différente possédée" },
  { key: "duels", label: "Duels", hint: "3 pts par victoire, 1 par nul" },
  { key: "matches", label: "Matchs", hint: "3 pts par victoire, 1 par nul, 11v11 et à la main" },
  { key: "challenges", label: "Défis", hint: "1 pt par défi réussi" },
  { key: "progress", label: "Progression", hint: "Points d'expérience gagnés" },
  { key: "market", label: "Marché", hint: "1 pt par vente aux enchères" },
  { key: "quiz", label: "Quiz", hint: "Points gagnés au Quiz foot (toutes parties)" },
] as const;

export type MeritDomain = (typeof MERIT_DOMAINS)[number]["key"];
export const MERIT_MAX = MERIT_DOMAINS.length * 100;

/** Raw points per domain. Pulls use the rare_pulled count fetched with Rare (rank 3) as the threshold. */
export function meritRaw(s: PlayerStats): Record<MeritDomain, number> {
  const d = duelRecord(s), m = matchRecord(s);
  return {
    pulls: Number(s.packs_opened) + 3 * Number(s.rare_pulled) + 15 * Number(s.legendary_pulled),
    collection: Number(s.unique_owned),
    duels: 3 * d.wins + d.draws,
    matches: 3 * m.wins + m.draws,
    challenges: Number(s.challenges_claimed),
    progress: Number(s.xp),
    market: Number(s.auctions_sold),
    quiz: Number(s.quiz_points ?? 0),
  };
}

export interface MeritRow {
  place: number;
  player: PlayerStats;
  total: number;
  scores: Record<MeritDomain, number>;
  raw: Record<MeritDomain, number>;
}

/**
 * Full ranking: domain scores (0–100, one decimal) relative to the domain leader, total = sum.
 * Players with nothing done are left out; ties go to the most domains led, then the name.
 */
export function rankMerit(rows: PlayerStats[]): MeritRow[] {
  const raws = rows.map((s) => ({ s, raw: meritRaw(s) }));
  const best = {} as Record<MeritDomain, number>;
  for (const { key } of MERIT_DOMAINS) best[key] = Math.max(0, ...raws.map((r) => r.raw[key]));
  return raws
    .map(({ s, raw }) => {
      const scores = {} as Record<MeritDomain, number>;
      let total = 0, led = 0;
      for (const { key } of MERIT_DOMAINS) {
        const v = best[key] > 0 ? Math.round((raw[key] / best[key]) * 1000) / 10 : 0;
        scores[key] = v;
        total += v;
        if (best[key] > 0 && raw[key] === best[key]) led++;
      }
      return { player: s, raw, scores, total: Math.round(total * 10) / 10, led };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || b.led - a.led || a.player.username.localeCompare(b.player.username, "fr"))
    .map(({ led: _led, ...r }, i) => ({ ...r, place: i + 1 }));
}

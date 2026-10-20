// Pure helpers for the daily / weekly challenges. Rotation, progress and payouts are computed
// server-side (get_my_periodic_challenges / claim_periodic_challenge); these mirror the rules for the UI.
import { isClaimable } from "@/lib/challenges";
import { rarityMeta } from "@/lib/rarity";

export type Period = "daily" | "weekly";

export interface PeriodicChallenge {
  challenge_id: string;
  key: string;
  period: Period | string;
  title: string;
  metric: "packs" | "cards" | "rarity" | "version" | "duels_played" | "duels_won" | string;
  rarity: string | null;
  version: string | null;
  target: number;
  reward_coins: number;
  reward_pack_key: string | null;
  reward_pack_name: string | null;
  reward_packs: number;
  progress: number;
  claimed: boolean;
  ends_at: string;
}

/** Coins and packs (per pack name) waiting to be collected. */
export function periodicSummary(list: PeriodicChallenge[]) {
  const ready = list.filter(isClaimable);
  const packs: Record<string, number> = {};
  for (const c of ready) {
    if (c.reward_packs > 0) {
      const name = c.reward_pack_name ?? c.reward_pack_key ?? "Pack";
      packs[name] = (packs[name] ?? 0) + c.reward_packs;
    }
  }
  return {
    count: ready.length,
    coins: ready.reduce((s, c) => s + c.reward_coins, 0),
    packs,
    packCount: Object.values(packs).reduce((s, n) => s + n, 0),
  };
}

export function packText(n: number, name: string | null) {
  return `${n} ${name ?? "Pack"}`;
}

/** Human countdown until the challenge is replaced, e.g. "5 h 12 min" or "2 j 4 h". */
export function timeLeft(endsAt: string | Date, now: number = Date.now()) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "maintenant";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "moins d'une minute";
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h > 0 ? `${d} j ${h} h` : `${d} j`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

const VERSION_LABEL: Record<string, string> = { alt: "Légendaire ALT", shiny: "Secrète Légendaire Shiny" };
const s = (n: number) => (n > 1 ? "s" : "");

export function periodicGoalText(c: Pick<PeriodicChallenge, "metric" | "rarity" | "version" | "target">) {
  const n = c.target;
  switch (c.metric) {
    case "packs": return `Ouvre ${n} pack${s(n)}`;
    case "cards": return `Tire ${n} carte${s(n)} dans tes packs`;
    case "rarity": return `Tire ${n} carte${s(n)} ${rarityMeta(c.rarity ?? "").label} dans tes packs`;
    case "version": return `Tire ${n} carte${s(n)} ${VERSION_LABEL[c.version ?? ""] ?? c.version} dans tes packs`;
    case "duels_played": return `Termine ${n} duel${s(n)} (sans abandon)`;
    case "duels_won": return `Gagne ${n} duel${s(n)} (sans abandon)`;
    default: return `Objectif : ${n}`;
  }
}

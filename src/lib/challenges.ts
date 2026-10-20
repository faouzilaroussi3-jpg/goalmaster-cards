// Pure helpers for the pack challenges (Défis). Progress and payouts are computed server-side
// (get_my_challenges / claim_challenge); these mirror the rules for the UI.
import { rarityMeta } from "@/lib/rarity";

export interface Challenge {
  challenge_id: string;
  key: string;
  title: string;
  metric: "total" | "rarity" | "version" | string;
  rarity: string | null;
  version: string | null;
  target: number;
  reward_coins: number;
  secret: boolean;
  sort_order: number;
  progress: number;
  claimed: boolean;
}

export type ChallengeState = "claimed" | "claimable" | "in_progress";

export function challengeState(c: Pick<Challenge, "progress" | "target" | "claimed">): ChallengeState {
  if (c.claimed) return "claimed";
  return c.progress >= c.target ? "claimable" : "in_progress";
}

export const isClaimable = (c: Pick<Challenge, "progress" | "target" | "claimed">) => challengeState(c) === "claimable";

export function progressRatio(c: Pick<Challenge, "progress" | "target">) {
  if (c.target <= 0) return 1;
  return Math.max(0, Math.min(1, c.progress / c.target));
}

export function claimableSummary(list: Challenge[]) {
  const ready = list.filter(isClaimable);
  return { count: ready.length, coins: ready.reduce((s, c) => s + c.reward_coins, 0) };
}

/** Challenges that became claimable between two snapshots (used to announce them after a pack). */
export function newlyClaimable<T extends Pick<Challenge, "challenge_id" | "progress" | "target" | "claimed">>(before: T[], after: T[]) {
  const was = new Set(before.filter(isClaimable).map((c) => c.challenge_id));
  return after.filter((c) => isClaimable(c) && !was.has(c.challenge_id));
}

export function categoryKey(c: Pick<Challenge, "metric" | "rarity" | "version">) {
  if (c.metric === "total") return "total";
  if (c.metric === "version") return c.version ?? "version";
  return c.rarity ?? "rarity";
}

const VERSION_NAMES: Record<string, { label: string; plural: string }> = {
  alt: { label: "Légendaire ALT", plural: "Légendaires ALT" },
  shiny: { label: "Secrète Légendaire Shiny", plural: "Secrètes Légendaires Shiny" },
};

const RARITY_PLURAL: Record<string, string> = {
  common: "Communes",
  uncommon: "Peu communes",
  rare: "Rares",
  super_rare: "Super Rares",
  legendary: "Légendaires",
  secret_legendary: "Secrètes Légendaires",
  secret_ultimate: "Secrètes Ultimes",
};

export function categoryLabel(c: Pick<Challenge, "metric" | "rarity" | "version">) {
  if (c.metric === "total") return "Toutes les cartes";
  if (c.metric === "version") return VERSION_NAMES[c.version ?? ""]?.label ?? (c.version ?? "Version");
  return rarityMeta(c.rarity ?? "").label;
}

export function goalText(c: Pick<Challenge, "metric" | "rarity" | "version" | "target">) {
  const n = c.target;
  if (c.metric === "total") return `Obtiens ${n} carte${n > 1 ? "s" : ""} en ouvrant des packs`;
  if (c.metric === "version") {
    const v = VERSION_NAMES[c.version ?? ""];
    return `Obtiens ${n} carte${n > 1 ? "s" : ""} ${n > 1 ? v?.plural ?? c.version : v?.label ?? c.version} dans tes packs`;
  }
  const label = n > 1 ? RARITY_PLURAL[c.rarity ?? ""] ?? rarityMeta(c.rarity ?? "").label : rarityMeta(c.rarity ?? "").label;
  return `Obtiens ${n} carte${n > 1 ? "s" : ""} ${label} dans tes packs`;
}

export function groupChallenges(list: Challenge[]) {
  const groups = new Map<string, { key: string; label: string; items: Challenge[] }>();
  for (const c of [...list].sort((a, b) => a.sort_order - b.sort_order || a.target - b.target)) {
    const key = categoryKey(c);
    if (!groups.has(key)) groups.set(key, { key, label: categoryLabel(c), items: [] });
    groups.get(key)!.items.push(c);
  }
  return [...groups.values()];
}

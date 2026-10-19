// Tactical duel rules. The server (play_card, _duel_power, _duel_deck, _finish_duel) is the source of truth;
// these pure helpers mirror it so the UI can preview powers and validate a team before sending it.
import { rarityMeta } from "@/lib/rarity";

export const DECK_SIZE = 5;
export const DECK_BUDGET = 20;
export const DAILY_REWARDED_DUELS = 5;
export const ROUND_TIMEOUT_HOURS = 24;
export const INVITE_TIMEOUT_HOURS = 48;

export const DUEL_COST: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  super_rare: 4,
  legendary: 6,
  secret_legendary: 8,
};

const RARITY_BONUS: Record<string, number> = { uncommon: 1, rare: 2, super_rare: 3, legendary: 4, secret_legendary: 5 };

export type Theme = "attaque" | "milieu" | "defense" | "gardien" | "libre";

export const THEMES: Record<Theme, { label: string; hint: string; positions: string[] }> = {
  attaque: { label: "Attaque", hint: "Attaquants et meneurs (BU, AD, AG, MOC) +6", positions: ["BU", "AD", "AG", "MOC"] },
  milieu: { label: "Milieu", hint: "Milieux (MC, MDC, MOC) +6", positions: ["MC", "MDC", "MOC"] },
  defense: { label: "Défense", hint: "Défenseurs et sentinelles (DC, DD, DG, MDC) +6", positions: ["DC", "DD", "DG", "MDC"] },
  gardien: { label: "Gardien", hint: "Gardien +6, tous les autres −6", positions: ["G"] },
  libre: { label: "Manche libre", hint: "Aucun bonus de poste : la note pure", positions: [] },
};

export interface DuelCardLike {
  pos: string;
  rarity: string;
  version?: string | null;
  rating: number;
}

// Admin-created rarities play like the built-in rarity whose effect they wear (as _rarity_fx does on the server).
export const duelCost = (rarity: string) => DUEL_COST[rarityMeta(rarity).fx] ?? 99;

export function positionModifier(pos: string, theme: Theme) {
  const p = pos.toUpperCase();
  if (p === "CLUB") return 2;
  if (theme === "libre") return 0;
  if (theme === "gardien") return p === "G" ? 6 : -6;
  if (p === "G") return -6;
  return THEMES[theme].positions.includes(p) ? 6 : 0;
}

export function cardPower(card: DuelCardLike, theme: Theme) {
  const version = card.version ?? "normal";
  return (
    card.rating +
    (RARITY_BONUS[card.rarity] ?? 0) +
    (version === "alt" || version === "shiny" ? 2 : 0) +
    positionModifier(card.pos, theme)
  );
}

export function deckCost(cards: Pick<DuelCardLike, "rarity">[]) {
  return cards.reduce((s, c) => s + duelCost(c.rarity), 0);
}

/** French reason the team cannot be sent, or null when it is valid. */
export function deckProblem(cards: (Pick<DuelCardLike, "rarity"> & { card_id: string })[]) {
  if (cards.length !== DECK_SIZE) return `Choisis ${DECK_SIZE} cartes (${cards.length}/${DECK_SIZE})`;
  if (new Set(cards.map((c) => c.card_id)).size !== cards.length) return "Un même joueur ne peut pas être deux fois dans ton équipe";
  if (cards.some((c) => c.rarity === "secret_ultimate")) return "Une de ces cartes ne peut pas jouer en duel";
  if (deckCost(cards) > DECK_BUDGET) return `Ton équipe dépasse le budget de ${DECK_BUDGET} points`;
  return null;
}

/** A duel stops early once the trailing player can no longer catch up. */
export function isDecided(scoreA: number, scoreB: number, roundsPlayed: number) {
  const remaining = DECK_SIZE - roundsPlayed;
  return remaining === 0 || Math.abs(scoreA - scoreB) > remaining;
}

/** Elo change for player A (score 1 win, 0.5 draw, 0 loss), K = 32. */
export function eloDelta(ratingA: number, ratingB: number, score: 0 | 0.5 | 1) {
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  return Math.round(32 * (score - expected));
}

/** Coins for one finished duel (before the daily cap). */
export function duelPayout(score: 0 | 0.5 | 1, forfeit: boolean) {
  if (score === 1) return 100;
  if (forfeit) return 0;
  return score === 0.5 ? 40 : 20;
}

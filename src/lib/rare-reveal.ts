/**
 * Timing of the big reveal animation played when a Légendaire-or-better card is turned over.
 * Presentation only: the card was already drawn on the server.
 */
import { chargeDelay, FLIP_MS } from "@/lib/card-reveal";

export type RareFx = "legendary" | "alt" | "secret_legendary" | "shiny" | "secret_ultimate";

export interface RareFxTiming {
  /** Glow build-up before the card flips, in ms. */
  build: number;
  /** Whole animation, from the tap to the last fading spark, in ms. */
  total: number;
}

export const RARE_FX_TIMING: Record<RareFx, RareFxTiming> = {
  legendary: { build: 1300, total: 3600 },
  alt: { build: 1400, total: 3800 },
  secret_legendary: { build: 1500, total: 4000 },
  shiny: { build: 1500, total: 4000 },
  secret_ultimate: { build: 1900, total: 4800 },
};

/** Which big reveal a card gets, or null below Légendaire. */
export function rareFx(rarity: string, version = "normal"): RareFx | null {
  if (rarity === "legendary") return version === "alt" ? "alt" : "legendary";
  if (rarity === "secret_legendary") return version === "shiny" ? "shiny" : "secret_legendary";
  if (rarity === "secret_ultimate") return "secret_ultimate";
  return null;
}

/**
 * When the card flips (charge), when the explosion hits (boom: the card face appears mid-flip),
 * and how long taps are ignored (lock) so the animation always plays out in full.
 */
export function revealTiming(card: { rarity: string; version: string; tier: number; is_bonus: boolean }) {
  const fx = rareFx(card.rarity, card.version);
  if (!fx) {
    const charge = chargeDelay(card.tier, card.is_bonus, card.version);
    return { fx, charge, boom: charge + FLIP_MS * 0.4, lock: charge + FLIP_MS, total: 0 };
  }
  const t = RARE_FX_TIMING[fx];
  return { fx, charge: t.build, boom: t.build + FLIP_MS * 0.4, lock: Math.max(t.build + FLIP_MS, t.total), total: t.total };
}

/** Timing for the tap-to-reveal stack. Presentation only: the cards were already drawn on the server. */

/** CSS variable holding each rarity's color, used to tint the charging card back. */
export const RARITY_VAR: Record<string, string> = {
  common: "var(--r-common)",
  uncommon: "var(--r-uncommon)",
  rare: "var(--r-rare)",
  super_rare: "var(--r-sr)",
  legendary: "var(--r-legendary)",
  secret_legendary: "var(--r-sl)",
  secret_ultimate: "var(--r-su)",
};

/** How long a card back charges up (shakes and glows) before it flips. Higher tiers build more suspense. */
export function chargeDelay(tier: number, isBonus: boolean, version = "normal"): number {
  let ms = tier >= 4 ? 500 + (tier - 4) * 250 : 120;
  if (isBonus) ms += 500 + (version !== "normal" ? 400 : 0);
  return ms;
}

/** Duration of the flip itself, in ms (matches the reveal-flip animation). */
export const FLIP_MS = 700;

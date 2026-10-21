import { isCardShape, isEffect, type CardShape, type RarityEffect } from "@/lib/rarity";

/** Look of a pack's card backs (pack_types.card_back): colour, mixed effects, outline and an optional picture. Looks only. */
export interface CardBackLook {
  color: string | null;
  effects: RarityEffect[];
  shape: CardShape;
  image_url: string | null;
}

export const DEFAULT_CARD_BACK: CardBackLook = { color: null, effects: [], shape: "standard", image_url: null };

/** Effects a card back cannot wear: "Simple" adds nothing, Secrète Ultime's fire and dragon stay unique to its cards. */
export const BACK_EXCLUDED_EFFECTS: readonly string[] = ["common", "secret_ultimate"];

const HEX = /^#[0-9a-f]{6}$/i;

/** Reads whatever is stored (possibly empty or hand-edited) into a safe look. */
export function cardBackOf(raw: unknown): CardBackLook {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const effects: RarityEffect[] = [];
  for (const e of Array.isArray(o["effects"]) ? o["effects"] : []) {
    if (typeof e === "string" && isEffect(e) && !BACK_EXCLUDED_EFFECTS.includes(e) && !effects.includes(e)) effects.push(e);
  }
  const color = typeof o["color"] === "string" && HEX.test(o["color"]) ? o["color"] : null;
  const image = typeof o["image_url"] === "string" && o["image_url"].trim() ? o["image_url"].trim() : null;
  return { color, effects: effects.slice(0, 6), shape: isCardShape(o["shape"]) ? o["shape"] : "standard", image_url: image };
}

/** True when the back differs from the default Goalmaster back. */
export const isCustomBack = (b: CardBackLook) => !!(b.color || b.effects.length || b.shape !== "standard" || b.image_url);

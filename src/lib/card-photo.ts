import { rarityMeta, type RarityStyle } from "@/lib/rarity";
// Uploaded card photos live in a private storage bucket and are served through
// /api/public/card-photo/<file>, so cards keep a stable same-origin image URL.
export const CARD_PHOTO_BUCKET = "card-photos";
export const CARD_PHOTO_ROUTE = "/api/public/card-photo/";

/** Max size of the stored portrait (cards are 2:3, shown full-frame). */
export const CARD_PHOTO_MAX = { width: 800, height: 1200 };

const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$/;

/** Only random-UUID file names written by the admin uploader can be served. */
export function isCardPhotoFile(name: string): boolean {
  return FILE_RE.test(name);
}

export function cardPhotoUrl(file: string): string {
  return `${CARD_PHOTO_ROUTE}${file}`;
}

/** Scale (w,h) to fit inside the max box without upscaling. */
export function fitWithin(w: number, h: number, max = CARD_PHOTO_MAX): { width: number; height: number } {
  const k = Math.min(1, max.width / w, max.height / h);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** Visual treatment PlayerCard applies automatically for a rarity + version. */
export function rarityEffects(rarity: string, version: "normal" | "alt" | "shiny" = "normal"): string[] {
  // Admin-created rarities wear the effect of a built-in one; only the real Secrète Ultime is hidden until pulled.
  const meta = rarityMeta(rarity);
  if (meta.style) return STYLE_EFFECTS[meta.style];
  const fx = meta.fx;
  const list = builtinEffects(fx, version);
  return rarity === fx ? list : list.filter((e) => !e.startsWith("Cachée"));
}

const STYLE_EFFECTS: Record<RarityStyle, string[]> = {
  metal: ["Chrome brossé", "Reflet d'acier"],
  tinted: ["Photo teintée", "Reflet lumineux"],
  cartoon: ["Contour BD", "Trame cartoon", "Couleurs vives"],
  vintage: ["Photo sépia", "Papier ancien"],
  neon: ["Tube néon clignotant", "Étincelles"],
  holo: ["Film holographique", "Bordure arc-en-ciel", "Étincelles"],
  frost: ["Bordure givrée", "Cristaux de glace", "Neige qui tombe"],
  galaxy: ["Nébuleuse cosmique", "Étoiles scintillantes"],
};

function builtinEffects(rarity: string, version: "normal" | "alt" | "shiny"): string[] {
  switch (rarity) {
    case "common": return ["Cadre simple"];
    case "uncommon": return ["Cadre peu commun"];
    case "rare": return ["Cadre rare", "Reflet lumineux"];
    case "super_rare": return ["Cadre super rare", "Reflet lumineux", "Étincelles"];
    case "legendary":
      return version === "alt"
        ? ["Bordure arc-en-ciel", "Paillettes", "Étincelles"]
        : ["Bordure dorée", "Paillettes", "Étincelles"];
    case "secret_legendary":
      return version === "shiny"
        ? ["Néon inversé bleu marine / blanc", "Paillettes"]
        : ["Bordure diamant", "Gros diamant autour du bord", "Petits diamants qui gravitent"];
    case "secret_ultimate":
      return ["Rouge métallisé", "Feu réaliste", "Dragon cracheur de feu qui fait le tour", "Cachée jusqu'au premier tirage"];
    default: return [];
  }
}

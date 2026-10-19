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
      return ["Bordure de flammes", "Feu réaliste", "Dragon cracheur de feu", "Cachée jusqu'au premier tirage"];
    default: return [];
  }
}

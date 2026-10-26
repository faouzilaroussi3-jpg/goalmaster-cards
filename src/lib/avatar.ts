// Avatar look options and rules, mirrored by public.save_avatar (SQL validates the same lists).

export const HAIR_STYLES = [
  { id: "short", label: "Courte" },
  { id: "buzz", label: "Rasée" },
  { id: "curly", label: "Bouclée" },
  { id: "afro", label: "Afro" },
  { id: "long", label: "Longue" },
  { id: "mohawk", label: "Crête" },
  { id: "bun", label: "Chignon" },
  { id: "dreads", label: "Dreads" },
  { id: "bald", label: "Chauve" },
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number]["id"];

export const SHOE_STYLES = [
  { id: "classic", label: "Classiques" },
  { id: "speed", label: "Vitesse" },
  { id: "high", label: "Montantes" },
] as const;
export type ShoeStyle = (typeof SHOE_STYLES)[number]["id"];

export const SKIN_TONES = ["#f6d7c3", "#eac0a0", "#d9a27b", "#c68642", "#a8673a", "#8d5524", "#6b3e1f", "#4a2a15"];
export const HAIR_COLORS = ["#0f0b09", "#2b1a10", "#5a3720", "#8a5a2b", "#c99a4b", "#efd08a", "#d9d6cf", "#b5241c", "#ff2d87", "#2a62ff"];
export const SHOE_COLORS = ["#ff2d87", "#ffffff", "#111111", "#f5c518", "#22c55e", "#2a62ff", "#ff6a00", "#9b5cff"];

export interface AvatarLook {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  shoes: ShoeStyle;
  shoeColor: string;
  /** Club whose kit the avatar wears; null = the Goalmaster kit everyone has. */
  club: string | null;
  shirtName: string;
  number: number;
}

export const DEFAULT_LOOK: AvatarLook = {
  skin: "#c68642", hair: "short", hairColor: "#0f0b09", shoes: "classic", shoeColor: "#ff2d87", club: null, shirtName: "", number: 10,
};

export interface AvatarRow {
  user_id: string; skin: string; hair: string; hair_color: string; shoes: string; shoe_color: string;
  kit_club: string | null; shirt_name: string; shirt_number: number;
}

const HEX = /^#[0-9a-f]{6}$/i;
const NAME = /^[A-ZÀ-ÖØ-Þ .'-]*$/;

export function lookFromRow(row: AvatarRow | null | undefined): AvatarLook {
  if (!row) return DEFAULT_LOOK;
  return {
    skin: HEX.test(row.skin) ? row.skin : DEFAULT_LOOK.skin,
    hair: (HAIR_STYLES.some((h) => h.id === row.hair) ? row.hair : DEFAULT_LOOK.hair) as HairStyle,
    hairColor: HEX.test(row.hair_color) ? row.hair_color : DEFAULT_LOOK.hairColor,
    shoes: (SHOE_STYLES.some((s) => s.id === row.shoes) ? row.shoes : DEFAULT_LOOK.shoes) as ShoeStyle,
    shoeColor: HEX.test(row.shoe_color) ? row.shoe_color : DEFAULT_LOOK.shoeColor,
    club: row.kit_club,
    shirtName: row.shirt_name ?? "",
    number: row.shirt_number,
  };
}

/** Shirt name as printed: upper case, letters/space/'/- only, 12 characters max. */
export function cleanShirtName(raw: string): string {
  return raw.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ .'-]/g, "").slice(0, 12);
}

export function clampNumber(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.min(99, Math.max(1, Math.round(n)));
}

/** Same checks as save_avatar; returns the French error the server would raise, or null. */
export function lookError(look: AvatarLook, unlockedClubs: string[]): string | null {
  if (![look.skin, look.hairColor, look.shoeColor].every((c) => HEX.test(c))) return "Couleur invalide";
  if (!HAIR_STYLES.some((h) => h.id === look.hair)) return "Coiffure inconnue";
  if (!SHOE_STYLES.some((s) => s.id === look.shoes)) return "Chaussures inconnues";
  if (!Number.isInteger(look.number) || look.number < 1 || look.number > 99) return "Numéro entre 1 et 99";
  if (look.shirtName.length > 12 || !NAME.test(look.shirtName)) return "Nom au dos : 12 lettres maximum";
  if (look.club !== null && !unlockedClubs.includes(look.club)) return "Tire une carte de ce club dans un pack pour débloquer son maillot";
  return null;
}

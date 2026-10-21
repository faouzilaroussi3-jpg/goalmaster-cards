// How an admin-customised pack looks: base art (Classique / Premium picture, or the admin's own picture),
// a tint colour applied as a hue shift so the artwork keeps its detail, and one visual effect around the pack.
export type PackArt = "classic" | "premium";
export type PackEffect = "none" | "flames" | "glow" | "sparkles" | "neon" | "holo" | "frost" | "shadow";

export interface PackLook { art: PackArt; tint: string | null; effect: PackEffect; image_url: string | null }

export const PACK_ARTS: { key: PackArt; label: string }[] = [
  { key: "classic", label: "Visuel Classique" },
  { key: "premium", label: "Visuel Premium" },
];

export const PACK_EFFECTS: { key: PackEffect; label: string; hint: string }[] = [
  { key: "none", label: "Aucun", hint: "Le pack seul, sans effet autour." },
  { key: "flames", label: "Flammes", hint: "Flammes animées derrière le pack (comme le Premium)." },
  { key: "glow", label: "Halo", hint: "Halo lumineux qui respire, de la couleur du pack." },
  { key: "sparkles", label: "Paillettes", hint: "Étoiles scintillantes tout autour." },
  { key: "neon", label: "Néon", hint: "Contour néon qui grésille." },
  { key: "holo", label: "Holographique", hint: "Les couleurs du pack changent en arc-en-ciel." },
  { key: "frost", label: "Givre", hint: "Aura glacée bleu-blanc." },
  { key: "shadow", label: "Ombre", hint: "Aura sombre et fumée noire." },
];

/** Hue of the original pack artwork (hot pink). */
export const BASE_HUE = 335;

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** CSS filter that turns the pink artwork into the chosen colour (greys and black/white drop the colour). */
export function tintFilter(tint: string | null | undefined): string | undefined {
  if (!tint) return undefined;
  const c = hexToHsl(tint);
  if (!c) return undefined;
  if (c.s < 0.15) return `grayscale(1) brightness(${(0.55 + c.l * 0.9).toFixed(2)}) contrast(1.1)`;
  const rot = Math.round((((c.h - BASE_HUE) % 360) + 540) % 360 - 180);
  const sat = (0.6 + c.s * 0.8).toFixed(2);
  const bri = (0.75 + c.l * 0.5).toFixed(2);
  return `hue-rotate(${rot}deg) saturate(${sat}) brightness(${bri})`;
}

export interface PackLookInput { art?: string | null | undefined; tint?: string | null | undefined; effect?: string | null | undefined; image_url?: string | null | undefined; pack_key?: string | undefined; key?: string | undefined }

export function packLookOf(p: PackLookInput): PackLook {
  const k = p.pack_key ?? p.key;
  const art: PackArt = p.art === "premium" || (!p.art && k === "premium") ? "premium" : "classic";
  const effect = (PACK_EFFECTS.some((e) => e.key === p.effect) ? p.effect : k === "premium" ? "flames" : "none") as PackEffect;
  return { art, tint: p.tint ?? null, effect, image_url: p.image_url || null };
}

/** French reason a pack form cannot be saved, or null. Rates are percentages per card slot. */
export function packDraftError(d: { name: string; slot_count: number; rates: Record<string, number> }) {
  if (!d.name.trim()) return "Donne un nom au pack";
  if (d.name.trim().length > 40) return "Nom trop long (40 caractères max)";
  if (!Number.isInteger(d.slot_count) || d.slot_count < 1 || d.slot_count > 10) return "Entre 1 et 10 cartes par pack";
  if (!Object.values(d.rates).some((v) => v > 0)) return "Coche au moins une rareté avec un taux";
  if (Object.values(d.rates).some((v) => v < 0)) return "Un taux ne peut pas être négatif";
  return null;
}

/** Exact chance (in %) that one card of the pack is of each rarity: rates are shares of their total. */
export function exactChances(rates: Record<string, number>, isActive: (key: string) => boolean = () => true) {
  const live = Object.entries(rates).filter(([k, v]) => v > 0 && isActive(k));
  const total = live.reduce((s, [, v]) => s + v, 0);
  return Object.fromEntries(live.map(([k, v]) => [k, total > 0 ? (v / total) * 100 : 0])) as Record<string, number>;
}

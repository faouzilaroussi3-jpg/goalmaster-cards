// Trophy looks chosen by the admin (trophy_designs rows); rules mirror the checks in admin_save_trophy_design.
import { TROPHY_LABEL, type TrophyKind } from "@/lib/ballon-dor";

export type TrophyFinish = "poli" | "satine" | "brosse";
export interface TrophyDesign {
  kind: TrophyKind;
  name: string;
  inscription: string;
  metal: string;
  base: string;
  gem: string;
  accent: string;
  finish: TrophyFinish;
  diamonds: boolean;
}

export const TROPHY_KINDS: TrophyKind[] = ["ballon", "rarest_card", "most_wins"];

/** The original look of every trophy: what a kind shows while the admin has not saved anything. */
export const DEFAULT_DESIGNS: Record<TrophyKind, TrophyDesign> = {
  ballon: { kind: "ballon", name: TROPHY_LABEL.ballon, inscription: "BALLON D'OR", metal: "#f4c542", base: "#0d0d0f", gem: "#ffffff", accent: "#f4c542", finish: "poli", diamonds: true },
  rarest_card: { kind: "rarest_card", name: TROPHY_LABEL.rarest_card, inscription: "", metal: "#f4c542", base: "#0d0d0f", gem: "#ffffff", accent: "#ff2d87", finish: "poli", diamonds: false },
  most_wins: { kind: "most_wins", name: TROPHY_LABEL.most_wins, inscription: "", metal: "#f4c542", base: "#0d0d0f", gem: "#ff2d87", accent: "#ff2d87", finish: "satine", diamonds: false },
};

export const METAL_PRESETS = [
  { label: "Or", color: "#f4c542" },
  { label: "Or rose", color: "#e8a28c" },
  { label: "Argent", color: "#d9dde3" },
  { label: "Platine", color: "#eef2f7" },
  { label: "Bronze", color: "#c47a3a" },
  { label: "Rose", color: "#ff2d87" },
  { label: "Noir", color: "#2a2a30" },
] as const;

export const FINISH_LABEL: Record<TrophyFinish, string> = { poli: "Poli miroir", satine: "Satiné", brosse: "Brossé" };
export const FINISH_ROUGHNESS: Record<TrophyFinish, number> = { poli: 0.16, satine: 0.34, brosse: 0.55 };

export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const INSCRIPTION_MAX = 24;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** First problem with a design, or null when the server will accept it. */
export function designError(d: TrophyDesign): string | null {
  const n = d.name.trim().length;
  if (n < NAME_MIN || n > NAME_MAX) return `Le nom doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères`;
  if (d.inscription.trim().length > INSCRIPTION_MAX) return `L'inscription fait ${INSCRIPTION_MAX} caractères maximum`;
  if (![d.metal, d.base, d.gem, d.accent].every((c) => HEX.test(c))) return "Couleur invalide";
  if (!(d.finish in FINISH_LABEL)) return "Finition invalide";
  return null;
}

/** Engraving is always in capitals, like the server stores it. */
export const cleanInscription = (s: string) => s.toUpperCase().slice(0, INSCRIPTION_MAX);

type Row = { kind: string; name?: string | null; inscription?: string | null; metal?: string | null; base?: string | null; gem?: string | null; accent?: string | null; finish?: string | null; diamonds?: boolean | null };

/** A kind's current look: its saved row, else the original. */
export function designOf(kind: TrophyKind, rows: Row[] | undefined): TrophyDesign {
  const row = rows?.find((r) => r.kind === kind);
  const d = DEFAULT_DESIGNS[kind];
  if (!row) return d;
  const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
  return {
    kind,
    name: str(row.name, d.name),
    inscription: str(row.inscription, d.inscription),
    metal: str(row.metal, d.metal),
    base: str(row.base, d.base),
    gem: str(row.gem, d.gem),
    accent: str(row.accent, d.accent),
    finish: (row.finish && row.finish in FINISH_LABEL ? row.finish : d.finish) as TrophyFinish,
    diamonds: typeof row.diamonds === "boolean" ? row.diamonds : d.diamonds,
  };
}

/** Display names of every trophy (custom name when the admin saved one). */
export function trophyNames(rows: Row[] | undefined): Record<TrophyKind, string> {
  return Object.fromEntries(TROPHY_KINDS.map((k) => [k, designOf(k, rows).name])) as Record<TrophyKind, string>;
}

export const sameDesign = (a: TrophyDesign, b: TrophyDesign) =>
  (Object.keys(a) as (keyof TrophyDesign)[]).every((k) => String(a[k]).toLowerCase() === String(b[k]).toLowerCase());

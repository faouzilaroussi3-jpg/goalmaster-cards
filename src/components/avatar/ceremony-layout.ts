import type { TrophyKind } from "@/lib/ballon-dor";

/** Shared positions of the Ballon d'Or hall (metres): the gala architecture and the ceremony show both read them. */
export const STAGE_Y = 0.5;
export const STAGE_FRONT = -1.5;
export const STAGE_BACK = -5.1;
export const STAGE_HALF_W = 5;
export const HALL_HALF_W = 9;
export const HALL_BACK = 13;
export const CEILING_Y = 7.8;
export const WINNER_XZ: [number, number] = [0, -2];
export const HOST_XZ: [number, number] = [-2.2, -2.3];
export const BACKSTAGE_XZ: [number, number] = [4.2, -3.6];

/** Ballon d'Or on the tall centre pedestal, the side trophies on lower ones either side. */
export const PEDESTALS: { kind: TrophyKind; x: number; z: number; h: number; scale: number }[] = [
  { kind: "ballon", x: 0, z: -3.1, h: 0.9, scale: 1.5 },
  { kind: "rarest_card", x: -1.3, z: -3.3, h: 0.6, scale: 1.35 },
  { kind: "most_wins", x: 1.3, z: -3.3, h: 0.6, scale: 1.35 },
];

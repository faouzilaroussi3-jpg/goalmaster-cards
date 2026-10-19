/** Rotation rules for the enlarged card viewer (pure, tested). */
export const VIEWER_DEG_PER_PX_Y = 0.6;
export const VIEWER_DEG_PER_PX_X = 0.35;
/** Tilt up/down is limited so the card never flips upside down; left/right spins freely (front and back). */
export const VIEWER_MAX_TILT_X = 40;

export interface Rotation {
  x: number;
  y: number;
}

export function dragRotation(start: Rotation, dx: number, dy: number): Rotation {
  const x = Math.max(-VIEWER_MAX_TILT_X, Math.min(VIEWER_MAX_TILT_X, start.x - dy * VIEWER_DEG_PER_PX_X));
  return { x, y: start.y + dx * VIEWER_DEG_PER_PX_Y };
}

/** Rotate by half a turn to the nearest face (used by the "Retourner" button). */
export function flipRotation(r: Rotation): Rotation {
  const faces = Math.round(r.y / 180);
  return { x: 0, y: (faces + 1) * 180 };
}

/** True when the back of the card faces the viewer. */
export function showsBack(r: Rotation): boolean {
  const y = ((r.y % 360) + 360) % 360;
  return y > 90 && y < 270;
}

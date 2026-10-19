// Pure rules for the "swipe left to open" gesture on the packs page.

/** Fraction of the stage width the pack must travel left to open. */
export const SWIPE_OPEN_RATIO = 0.35;
/** Cap on that distance (px) so wide screens do not need a huge drag. */
export const SWIPE_OPEN_MAX = 160;
/** Leftward flick speed (px/ms) that opens even under the distance threshold. */
export const SWIPE_FLICK_SPEED = 0.5;
/** Minimum travel (px) for a flick to count, so a tap never opens. */
export const SWIPE_FLICK_MIN = 40;

/** Visual offset while dragging: free to the left, strong resistance to the right. */
export function dragOffset(rawDx: number): number {
  return rawDx < 0 ? rawDx : rawDx * 0.2;
}

/** Progress 0..1 toward opening, used for the glow and hint feedback. */
export function swipeProgress(dx: number, width: number): number {
  if (width <= 0 || dx >= 0) return 0;
  return Math.min(1, -dx / Math.min(width * SWIPE_OPEN_RATIO, SWIPE_OPEN_MAX));
}

/** Decide on release whether the pack opens. velocity is px/ms, negative = left. */
export function shouldOpen(dx: number, velocity: number, width: number): boolean {
  if (dx >= 0) return false;
  if (swipeProgress(dx, width) >= 1) return true;
  return velocity <= -SWIPE_FLICK_SPEED && -dx >= SWIPE_FLICK_MIN;
}

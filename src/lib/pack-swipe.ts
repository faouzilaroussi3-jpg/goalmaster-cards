// Pure rules for the "tear the top strip from left to right" gesture on the packs page.

/** Fraction of the pack width the finger must travel right to fully tear the strip. */
export const TEAR_RATIO = 0.8;
/** Rightward flick speed (px/ms) that finishes the tear once half done. */
export const TEAR_FLICK_SPEED = 0.5;
/** Progress needed before a flick can finish the tear, so a tap never opens. */
export const TEAR_FLICK_MIN_PROGRESS = 0.5;

/** Tear progress 0..1 from the horizontal travel since the finger touched the line. */
export function tearProgress(dx: number, width: number): number {
  if (width <= 0 || dx <= 0) return 0;
  return Math.min(1, dx / (width * TEAR_RATIO));
}

/** Decide on release whether the strip is torn off. velocity is px/ms, positive = right. */
export function shouldTear(dx: number, velocity: number, width: number): boolean {
  const p = tearProgress(dx, width);
  if (p >= 1) return true;
  return p >= TEAR_FLICK_MIN_PROGRESS && velocity >= TEAR_FLICK_SPEED;
}

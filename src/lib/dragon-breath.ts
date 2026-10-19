// Timing of the Secret Ultimate dragon's fire breath. Pure functions (no DOM) so they are testable.

/** Head rears back and the mouth glows before the fire comes out, in ms. */
export const BREATH_WINDUP_MS = 380;
/** How long the fire jet pours out, in ms. */
export const BREATH_FIRE_MS = 1400;
/** Whole breath, wind-up + fire + the head settling back, in ms (matches the CSS su-head-breath animation). */
export const BREATH_TOTAL_MS = 2000;
/** Pause between two breaths of the same card, in ms. */
export const BREATH_PAUSE_MS = [3200, 7200] as const;

/** Random pause before the next breath: every card draws its own, so SU cards side by side never breathe in sync. */
export function nextBreathDelay(rand: () => number = Math.random): number {
  return Math.round(BREATH_PAUSE_MS[0] + (BREATH_PAUSE_MS[1] - BREATH_PAUSE_MS[0]) * rand());
}

/** Strength of the fire jet (0..1) at `ms` after the breath started: off during wind-up, quick ramp up, soft fade out. */
export function breathIntensity(ms: number): number {
  const t = ms - BREATH_WINDUP_MS;
  if (t <= 0 || t >= BREATH_FIRE_MS) return 0;
  if (t < 150) return t / 150;
  if (t > BREATH_FIRE_MS - 300) return (BREATH_FIRE_MS - t) / 300;
  return 1;
}

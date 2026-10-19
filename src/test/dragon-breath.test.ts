import { describe, expect, it } from "vitest";
import { BREATH_FIRE_MS, BREATH_PAUSE_MS, BREATH_TOTAL_MS, BREATH_WINDUP_MS, breathIntensity, nextBreathDelay } from "@/lib/dragon-breath";

describe("SU dragon fire breath", () => {
  it("each card waits its own random pause, so cards never breathe in sync", () => {
    expect(nextBreathDelay(() => 0)).toBe(BREATH_PAUSE_MS[0]);
    expect(nextBreathDelay(() => 1)).toBe(BREATH_PAUSE_MS[1]);
    expect(nextBreathDelay(() => 0.2)).not.toBe(nextBreathDelay(() => 0.7));
  });

  it("no fire while the head rears back, full jet in the middle, none after", () => {
    expect(breathIntensity(BREATH_WINDUP_MS - 10)).toBe(0);
    expect(breathIntensity(BREATH_WINDUP_MS + BREATH_FIRE_MS / 2)).toBe(1);
    expect(breathIntensity(BREATH_WINDUP_MS + BREATH_FIRE_MS + 10)).toBe(0);
  });

  it("the fire ends before the head has settled back", () => {
    expect(BREATH_WINDUP_MS + BREATH_FIRE_MS).toBeLessThanOrEqual(BREATH_TOTAL_MS);
  });
});

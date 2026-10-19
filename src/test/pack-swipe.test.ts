import { describe, expect, it } from "vitest";
import { shouldTear, tearProgress } from "@/lib/pack-swipe";

describe("pack tear", () => {
  it("tears once the finger crosses 80% of the pack width to the right", () => {
    expect(shouldTear(160, 0, 200)).toBe(true);
    expect(shouldTear(150, 0, 200)).toBe(false);
  });

  it("finishes on a fast rightward flick past half way", () => {
    expect(shouldTear(90, 0.8, 200)).toBe(true);
    expect(shouldTear(60, 0.8, 200)).toBe(false);
  });

  it("never tears when dragging right to left", () => {
    expect(shouldTear(-200, -2, 200)).toBe(false);
    expect(tearProgress(-50, 200)).toBe(0);
  });
});

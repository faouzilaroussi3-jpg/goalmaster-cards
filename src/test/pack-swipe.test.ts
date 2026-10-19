import { describe, expect, it } from "vitest";
import { dragOffset, shouldOpen, swipeProgress } from "@/lib/pack-swipe";

describe("pack swipe", () => {
  it("opens once the pack travels 35% of the stage to the left", () => {
    expect(shouldOpen(-140, 0, 400)).toBe(true);
    expect(shouldOpen(-130, 0, 400)).toBe(false);
  });

  it("opens on a fast leftward flick even if short", () => {
    expect(shouldOpen(-60, -0.9, 400)).toBe(true);
  });

  it("never opens when dragged right or tapped", () => {
    expect(shouldOpen(200, -2, 400)).toBe(false);
    expect(shouldOpen(-10, -2, 400)).toBe(false);
  });

  it("resists dragging to the right", () => {
    expect(dragOffset(100)).toBe(20);
    expect(dragOffset(-100)).toBe(-100);
    expect(swipeProgress(50, 400)).toBe(0);
  });
});

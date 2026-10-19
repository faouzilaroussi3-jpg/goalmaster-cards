import { describe, expect, it } from "vitest";
import { dragRotation, flipRotation, showsBack } from "@/lib/card-viewer";

describe("card viewer rotation", () => {
  it("dragging sideways spins the card freely", () => {
    expect(dragRotation({ x: 0, y: 0 }, 600, 0).y).toBe(360);
  });
  it("tilting up/down is capped at 40 degrees", () => {
    expect(dragRotation({ x: 0, y: 0 }, 0, -1000).x).toBe(40);
    expect(dragRotation({ x: 0, y: 0 }, 0, 1000).x).toBe(-40);
  });
  it("flip turns to the other face", () => {
    expect(flipRotation({ x: 12, y: 20 })).toEqual({ x: 0, y: 180 });
    expect(showsBack({ x: 0, y: 180 })).toBe(true);
    expect(showsBack({ x: 0, y: -350 })).toBe(false);
  });
});

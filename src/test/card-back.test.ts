import { describe, expect, it } from "vitest";
import { cardBackOf, isCustomBack } from "@/lib/card-back";

describe("pack card backs", () => {
  it("falls back to the default Goalmaster back when nothing is set", () => {
    const b = cardBackOf({});
    expect(b).toEqual({ color: null, effects: [], shape: "standard", image_url: null });
    expect(isCustomBack(b)).toBe(false);
  });

  it("keeps the chosen colour, shape, picture and mixed effects in order", () => {
    const b = cardBackOf({ color: "#ff3d9a", effects: ["marble", "legendary", "marble"], shape: "wanted", image_url: " https://x/y.jpg " });
    expect(b).toEqual({ color: "#ff3d9a", effects: ["marble", "legendary"], shape: "wanted", image_url: "https://x/y.jpg" });
    expect(isCustomBack(b)).toBe(true);
  });

  it("drops unknown values and never lets a back wear Secrète Ultime or Simple", () => {
    expect(cardBackOf({ color: "red", effects: ["secret_ultimate", "common", "nope"], shape: "blob" })).toEqual({ color: null, effects: [], shape: "standard", image_url: null });
  });
});

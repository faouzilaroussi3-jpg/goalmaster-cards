import { describe, expect, it } from "vitest";
import { FLIGHT_RX, FLIGHT_RZ, FLIGHT_Y_MAX, flightAngularSpeed, flightPoint, makeFlight } from "@/lib/dragon-flight";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("SU dragon flight", () => {
  it("two cards get different, unsynchronised paths", () => {
    const a = makeFlight(seeded(1));
    const b = makeFlight(seeded(2));
    const pa = flightPoint(a, 3);
    const pb = flightPoint(b, 3);
    expect(Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])).toBeGreaterThan(0.5);
  });

  it("stays inside the overlay around the card", () => {
    for (let seed = 1; seed < 40; seed++) {
      const f = makeFlight(seeded(seed));
      for (let t = 0; t < 60; t += 0.25) {
        const [x, y, z] = flightPoint(f, t);
        expect(Math.abs(x)).toBeLessThanOrEqual(FLIGHT_RX[1] + 1e-9);
        expect(Math.abs(z)).toBeLessThanOrEqual(FLIGHT_RZ[1] + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(FLIGHT_Y_MAX + 1e-9);
      }
    }
  });

  it("changes direction now and then instead of a fixed loop", () => {
    let reverses = 0;
    for (let seed = 1; seed < 40; seed++) {
      const f = makeFlight(seeded(seed));
      let prev = Math.sign(flightAngularSpeed(f, 0));
      for (let t = 0; t < 60; t += 0.1) {
        const s = Math.sign(flightAngularSpeed(f, t));
        if (s !== prev) { reverses++; break; }
        prev = s;
      }
    }
    expect(reverses).toBeGreaterThan(5);
  });
});

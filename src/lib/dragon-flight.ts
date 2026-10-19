// Free-roaming flight path for the Secret Ultimate 3D dragon. Every card draws its own random
// parameters, so two SU cards on screen never fly in sync. Pure math (no three.js) so it is testable.

export type Flight = {
  a0: number; // starting angle around the card
  dir: 1 | -1; // overall direction of travel
  w: number; // base angular speed (rad/s)
  surgeAmp: number; // speed surges; when surgeAmp*surgeFreq > w the dragon turns back for a moment
  surgeFreq: number;
  surgePhase: number;
  yPhaseA: number;
  yPhaseB: number;
  yFreqA: number;
  yFreqB: number;
  rPhase: number;
  rFreq: number;
};

// Envelope in world units (card is 5 x 7 at the origin): keeps the dragon inside the overlay.
export const FLIGHT_RX = [2.55, 3.1] as const;
export const FLIGHT_RZ = [2.0, 2.8] as const;
export const FLIGHT_Y_MAX = 2.5;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function makeFlight(rand: () => number = Math.random): Flight {
  return {
    a0: rand() * Math.PI * 2,
    dir: rand() < 0.5 ? 1 : -1,
    w: lerp(0.75, 1.15, rand()),
    surgeAmp: lerp(1.1, 1.9, rand()),
    surgeFreq: lerp(0.45, 0.8, rand()),
    surgePhase: rand() * Math.PI * 2,
    yPhaseA: rand() * Math.PI * 2,
    yPhaseB: rand() * Math.PI * 2,
    yFreqA: lerp(0.38, 0.6, rand()),
    yFreqB: lerp(0.95, 1.4, rand()),
    rPhase: rand() * Math.PI * 2,
    rFreq: lerp(0.3, 0.55, rand()),
  };
}

/** Angle around the card at time t (seconds). */
export function flightAngle(f: Flight, t: number) {
  return f.a0 + f.dir * (f.w * t + f.surgeAmp * Math.sin(f.surgeFreq * t + f.surgePhase));
}

/** Signed angular speed, used to bank into turns (and flip the bank when the dragon turns back). */
export function flightAngularSpeed(f: Flight, t: number) {
  return f.dir * (f.w + f.surgeAmp * f.surgeFreq * Math.cos(f.surgeFreq * t + f.surgePhase));
}

/** Position [x, y, z] at time t; x/z circle the card (z > 0 is in front), y climbs and dives. */
export function flightPoint(f: Flight, t: number): [number, number, number] {
  const a = flightAngle(f, t);
  const k = 0.5 + 0.5 * Math.sin(f.rFreq * t + f.rPhase);
  const rx = lerp(FLIGHT_RX[0], FLIGHT_RX[1], k);
  const rz = lerp(FLIGHT_RZ[0], FLIGHT_RZ[1], 1 - k);
  const y = 1.7 * Math.sin(f.yFreqA * t + f.yPhaseA) + 0.8 * Math.sin(f.yFreqB * t + f.yPhaseB);
  return [rx * Math.cos(a), y, rz * Math.sin(a)];
}

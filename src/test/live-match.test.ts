import { describe, expect, it } from "vitest";
import { FORMATIONS, HALF_SECONDS, rateTeam, type MatchCard } from "@/lib/manager";
import {
  canSteal, CONTACT_STEAL, createGame, idlePad, liveMatchPayout, shotPower, startGame, stepGame, TACKLE_RANGE, type Game,
} from "@/lib/live-match";

const card = (i: number, pos: string, rating = 80): MatchCard => ({
  user_card_id: `u${i}`, card_id: `c${i}`, name: `Joueur ${i}`, club: `Club ${i}`, nationality: `Pays ${i}`,
  pos, rating, rarity: "common", version: "normal", image_url: null,
});
const team = (offset: number, rating = 80) =>
  rateTeam("4-3-3", "equilibre", FORMATIONS["4-3-3"].slots.map((s, i) => card(offset + i, s.role, rating)));

function playOut(g: Game, pads: () => Parameters<typeof stepGame>[1] = () => ({})) {
  startGame(g);
  let n = 0;
  while (g.phase !== "ended" && n < 60 * 400) { stepGame(g, pads()); n++; }
  return n;
}

describe("steered match rules", () => {
  it("running over the ball carrier wins the ball, without pressing anything", () => {
    expect(canSteal(0.5, false)).toBe(true);
    expect(canSteal(CONTACT_STEAL, false)).toBe(true);
    expect(canSteal(1.5, false)).toBe(false);
  });

  it("holding shoot very close to the carrier wins the ball, but not from further away", () => {
    expect(canSteal(1.5, true)).toBe(true);
    expect(canSteal(TACKLE_RANGE, true)).toBe(true);
    expect(canSteal(2.5, true)).toBe(false);
  });

  it("winner takes the win payout, loser the loss payout, a draw pays both the same", () => {
    expect(liveMatchPayout(2, 1)).toBe(150);
    expect(liveMatchPayout(0, 3)).toBe(30);
    expect(liveMatchPayout(1, 1)).toBe(60);
    expect(liveMatchPayout(1, 1)).toBe(liveMatchPayout(1, 1));
  });

  it("a longer hold gives a stronger shot, capped at full power", () => {
    expect(shotPower(0)).toBe(0.15);
    expect(shotPower(375)).toBeCloseTo(0.5);
    expect(shotPower(5000)).toBe(1);
  });

  it("a match is two halves of 1 min 20 and always ends", () => {
    const g = createGame(team(0), team(20), { human: { home: false, away: false }, level: "legendaire", seed: "t1" });
    const steps = playOut(g);
    expect(g.phase).toBe("ended");
    expect(g.half).toBe(2);
    expect(steps / 60).toBeGreaterThanOrEqual(HALF_SECONDS * 2);
    expect(g.score.home + g.score.away).toBeLessThan(25);
  });

  it("a human who does nothing still gets a full match with the computer", () => {
    const g = createGame(team(0), team(20), { human: { home: true, away: false }, level: "royal", seed: "t2" });
    playOut(g, () => ({ home: idlePad() }));
    expect(g.phase).toBe("ended");
    expect(g.score.away).toBeGreaterThanOrEqual(g.score.home);
  });
});

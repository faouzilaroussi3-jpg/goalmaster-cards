import { describe, expect, it } from "vitest";
import { autoPick, chemistry, firstName, FORMATIONS, matchClock, matchPayout, positionFit, rateTeam, teamProblem, type MatchCard } from "@/lib/manager";
import { buildTimeline, frameAt, type MatchEvent } from "@/lib/match-replay";

const card = (i: number, pos: string, extra: Partial<MatchCard> = {}): MatchCard => ({
  user_card_id: `u${i}`, card_id: `c${i}`, name: `Joueur ${i}`, club: `Club ${i}`, nationality: `Pays ${i}`,
  pos, rating: 80, rarity: "common", version: "normal", image_url: null, ...extra,
});
const xi433 = () => FORMATIONS["4-3-3"].slots.map((s, i) => card(i, s.role));

describe("manager team rules", () => {
  it("a player at his position plays at 0, a close position −3, elsewhere −10, keeper swaps −30", () => {
    expect(positionFit("BU", "BU")).toBe(0);
    expect(positionFit("AD", "BU")).toBe(-3);
    expect(positionFit("DC", "BU")).toBe(-10);
    expect(positionFit("G", "BU")).toBe(-30);
    expect(positionFit("DC", "G")).toBe(-30);
  });

  it("collectif: 1 club mate +1, 2+ +2; 2-3 compatriots +1, 4+ +2; nothing out of position", () => {
    expect(chemistry(1, 0, 0)).toBe(1);
    expect(chemistry(2, 4, 0)).toBe(4);
    expect(chemistry(0, 2, -3)).toBe(1);
    expect(chemistry(3, 5, -10)).toBe(0);
  });

  it("effective rating adds rarity (+5 max), ALT/Shiny +2, collectif and position", () => {
    const xi = xi433();
    xi[9] = card(9, "BU", { rarity: "secret_legendary", version: "shiny", club: "Club 10", nationality: "Pays 8" });
    const t = rateTeam("4-3-3", "equilibre", xi);
    // 80 + 5 (SL) + 2 (Shiny) + 1 (one club mate); a single compatriot gives nothing
    expect(t.players[9]!.chem).toBe(1);
    expect(t.players[9]!.eff).toBe(88);
    expect(t.general).toBe(80);
  });

  it("an offensive tactic moves 3 points from defence to attack", () => {
    const xi = xi433();
    const eq = rateTeam("4-3-3", "equilibre", xi);
    const off = rateTeam("4-3-3", "offensive", xi);
    expect(off.attack - eq.attack).toBe(3);
    expect(eq.defense - off.defense).toBe(3);
  });

  it("an extra player in a line is worth +2 for that line", () => {
    const flat = (f: "4-4-2" | "5-3-2") => FORMATIONS[f].slots.map((s, i) => card(i, s.role));
    expect(rateTeam("5-3-2", "equilibre", flat("5-3-2")).defense).toBe(82);
    expect(rateTeam("4-4-2", "equilibre", flat("4-4-2")).midfield).toBe(82);
  });

  it("a team needs 11 different players, at most 5 subs, no Club or Secrète Ultime card", () => {
    const xi = xi433();
    expect(teamProblem(xi, [])).toBeNull();
    expect(teamProblem(xi.slice(0, 10), [])).not.toBeNull();
    expect(teamProblem(xi, [card(0, "G", { user_card_id: "dup" })])).not.toBeNull();
    expect(teamProblem(xi, Array.from({ length: 6 }, (_, i) => card(20 + i, "MC")))).not.toBeNull();
    expect(teamProblem([...xi.slice(0, 10), card(30, "CLUB")], [])).not.toBeNull();
    expect(teamProblem([...xi.slice(0, 10), card(31, "BU", { rarity: "secret_ultimate" })], [])).not.toBeNull();
  });

  it("auto-pick puts the keeper in goal and never the same player twice", () => {
    const pool = [card(1, "G", { rating: 70 }), card(2, "G", { rating: 85 }), ...Array.from({ length: 12 }, (_, i) => card(10 + i, ["DC", "MC", "BU"][i % 3]!))];
    const { xi, bench } = autoPick("4-3-3", pool);
    expect(xi[0]!.card_id).toBe("c2");
    const ids = [...xi, ...bench].filter(Boolean).map((c) => c!.card_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("pays 150 for a win, 60 for a draw, 30 for a loss", () => {
    expect(matchPayout(1)).toBe(150);
    expect(matchPayout(0.5)).toBe(60);
    expect(matchPayout(0)).toBe(30);
  });

  it("a half of 1 min 20 shows 45 minutes on the clock; pawns show the first name", () => {
    expect(matchClock(1, 80)).toBe("45:00");
    expect(matchClock(2, 40)).toBe("67:30");
    expect(firstName("Kylian Mbappé")).toBe("Kylian");
    expect(firstName("Pelé")).toBe("Pelé");
  });
});

describe("match replay", () => {
  const team = { formation: "4-3-3" as const, players: xi433().map((c, i) => ({ slot: i, name: c.name })) };
  const events: MatchEvent[] = [
    { t: 10, side: "home", kind: "goal", shooter: 9, assist: 6, defender: 2, keeper: 0 },
    { t: 10.5, side: "away", kind: "save", shooter: 8, assist: 5, defender: 1, keeper: 0 },
    { t: 30, side: "away", kind: "goal", shooter: 10, assist: 7, defender: 3, keeper: 0 },
    { t: 50, side: "home", kind: "miss", shooter: 9, assist: null, defender: 2, keeper: 0 },
    { t: 70, side: "home", kind: "tackle", shooter: 8, assist: 5, defender: 4, keeper: 0 },
  ];

  it("shows every server event once, with exactly the server's goals", () => {
    const tl = buildTimeline(team, team, events, "m1-1");
    expect(tl.feed.map((f) => f.kind)).toEqual(events.map((e) => e.kind));
    const last = tl.feed[tl.feed.length - 1]!;
    expect([last.home, last.away]).toEqual([1, 1]);
    expect(tl.end).toBeGreaterThanOrEqual(80);
  });

  it("the ball path is continuous (it only jumps on dead balls) and the same for both managers", () => {
    const tl = buildTimeline(team, team, events, "m1-1");
    for (let i = 1; i < tl.segs.length; i++) {
      const a = tl.segs[i - 1]!, b = tl.segs[i]!;
      expect(b.t0).toBeCloseTo(a.t1, 6);
      if (b.kind !== "dead") expect(Math.hypot(b.from.x - a.to.x, b.from.y - a.to.y)).toBeLessThan(1e-6);
    }
    expect(buildTimeline(team, team, events, "m1-1").segs).toEqual(tl.segs);
    const f = frameAt(tl, 20);
    expect(Object.keys(f.pawns)).toHaveLength(22);
  });
});

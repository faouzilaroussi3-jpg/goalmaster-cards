import { describe, expect, it } from "vitest";
import { awardedIn, canAward, canStart, currentCeremony, nextTrophy, sideTrophiesOf, stageMoment, trophiesOf, type Ceremony, type CeremonyAward } from "@/lib/ballon-dor";

const c = (o: Partial<Ceremony>): Ceremony => ({
  id: "x", title: "BO", scheduled_at: "2026-11-01T19:00:00Z", reward_coins: 1000, status: "scheduled",
  winner_id: null, winner_name: null, started_at: null, awarded_at: null, created_at: "2026-10-01T00:00:00Z", ...o,
});

describe("Ballon d'Or ceremonies", () => {
  it("shows the live ceremony first, then the next scheduled one", () => {
    const live = c({ id: "live", status: "live" });
    const soon = c({ id: "soon", scheduled_at: "2026-11-01T19:00:00Z" });
    const later = c({ id: "later", scheduled_at: "2026-11-08T19:00:00Z" });
    expect(currentCeremony([later, soon, live])?.id).toBe("live");
    expect(currentCeremony([later, soon])?.id).toBe("soon");
  });
  it("keeps a just-awarded ceremony on stage for 3 hours before showing the next one", () => {
    const done = c({ id: "done", status: "finished", winner_id: "u", awarded_at: "2026-11-01T20:00:00Z" });
    const next = c({ id: "next", scheduled_at: "2026-11-08T19:00:00Z" });
    expect(currentCeremony([next, done], Date.parse("2026-11-01T22:59:00Z"))?.id).toBe("done");
    expect(currentCeremony([next, done], Date.parse("2026-11-01T23:01:00Z"))?.id).toBe("next");
  });
  it("only one ceremony can be live at a time", () => {
    const live = c({ id: "a", status: "live" });
    const next = c({ id: "b" });
    expect(canStart(next, [live, next])).toBe(false);
    expect(canStart(next, [next])).toBe(true);
  });
  it("the winner is named only during a live ceremony", () => {
    expect(canAward(c({ status: "scheduled" }))).toBe(false);
    expect(canAward(c({ status: "live" }))).toBe(true);
    expect(canAward(c({ status: "finished" }))).toBe(false);
  });
  it("counts each Ballon d'Or won for the player's showcase", () => {
    const list = [
      c({ id: "1", status: "finished", winner_id: "u1", awarded_at: "2026-10-04T20:00:00Z" }),
      c({ id: "2", status: "finished", winner_id: "u2", awarded_at: "2026-10-11T20:00:00Z" }),
      c({ id: "3", status: "finished", winner_id: "u1", awarded_at: "2026-10-18T20:00:00Z" }),
      c({ id: "4", status: "cancelled", winner_id: "u1" }),
    ];
    expect(trophiesOf(list, "u1").map((t) => t.id)).toEqual(["3", "1"]);
  });
});


const aw = (o: Partial<CeremonyAward>): CeremonyAward => ({
  id: "a", ceremony_id: "live", kind: "rarest_card", winner_id: "u1", winner_name: "Ana", detail: "", reward_coins: 500, awarded_at: "2026-11-01T19:05:00Z", ...o,
});
const both = { rarest_card: true, most_wins: true };

describe("Side trophies before the Ballon d'Or", () => {
  it("hands out the rarest card trophy first, then most matches won, then the Ballon d'Or", () => {
    expect(nextTrophy([], "live", both)).toBe("rarest_card");
    expect(nextTrophy([aw({ kind: "rarest_card" })], "live", both)).toBe("most_wins");
    expect(nextTrophy([aw({ kind: "rarest_card" }), aw({ id: "b", kind: "most_wins" })], "live", both)).toBe("ballon");
  });
  it("skips a side trophy nobody qualifies for this week", () => {
    expect(nextTrophy([], "live", { rarest_card: true, most_wins: false })).toBe("rarest_card");
    expect(nextTrophy([], "live", { rarest_card: false, most_wins: false })).toBe("ballon");
  });
  it("awards from another ceremony do not count for this one", () => {
    expect(nextTrophy([aw({ ceremony_id: "last-week" })], "live", both)).toBe("rarest_card");
  });
  it("puts the latest side trophy on stage, and the Ballon d'Or once awarded", () => {
    const live = c({ id: "live", status: "live" });
    const list = [aw({ kind: "rarest_card", awarded_at: "2026-11-01T19:05:00Z" }), aw({ id: "b", kind: "most_wins", winner_name: "Bo", awarded_at: "2026-11-01T19:10:00Z" })];
    expect(stageMoment(live, list)?.kind).toBe("most_wins");
    expect(stageMoment(live, list)?.winnerName).toBe("Bo");
    const done = c({ id: "live", status: "finished", winner_id: "u9", winner_name: "Zed" });
    expect(stageMoment(done, list)?.kind).toBe("ballon");
    expect(awardedIn(done, list)).toEqual(["rarest_card", "most_wins", "ballon"]);
  });
  it("side trophies go to the winner's showcase", () => {
    const list = [aw({ id: "1", winner_id: "u1" }), aw({ id: "2", winner_id: "u2" })];
    expect(sideTrophiesOf(list, "u1").map((a) => a.id)).toEqual(["1"]);
  });
});

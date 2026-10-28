import { describe, expect, it } from "vitest";
import { canAward, canStart, currentCeremony, trophiesOf, type Ceremony } from "@/lib/ballon-dor";

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

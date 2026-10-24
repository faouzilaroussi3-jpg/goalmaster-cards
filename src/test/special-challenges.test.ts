import { describe, expect, it } from "vitest";
import { durationMinutes, specialError, specialStatus, type SpecialForm } from "@/lib/special-challenges";

const form = (o: Partial<SpecialForm> = {}): SpecialForm => ({
  title: "Week-end de folie", metric: "packs", rarity: "", version: "alt", target: 10,
  coins: 500, packKey: "classic", packs: 0, amount: 3, unit: "days", ...o,
});

describe("admin special challenges", () => {
  it("converts the chosen duration into minutes", () => {
    expect(durationMinutes(6, "hours")).toBe(360);
    expect(durationMinutes(3, "days")).toBe(4320);
  });

  it("accepts a duration between 1 hour and 90 days only", () => {
    expect(specialError(form({ amount: 1, unit: "hours" }))).toBeNull();
    expect(specialError(form({ amount: 90, unit: "days" }))).toBeNull();
    expect(specialError(form({ amount: 0.5, unit: "hours" }))).not.toBeNull();
    expect(specialError(form({ amount: 91, unit: "days" }))).not.toBeNull();
  });

  it("needs at least one reward, and a pack when packs are offered", () => {
    expect(specialError(form({ coins: 0, packs: 0 }))).not.toBeNull();
    expect(specialError(form({ coins: 0, packs: 2, packKey: "" }))).not.toBeNull();
    expect(specialError(form({ coins: 0, packs: 2, packKey: "premium" }))).toBeNull();
  });

  it("never lets a challenge reveal the Secret Ultimate rarity", () => {
    expect(specialError(form({ metric: "rarity", rarity: "secret_ultimate" }))).not.toBeNull();
    expect(specialError(form({ metric: "rarity", rarity: "legendary" }))).toBeNull();
  });

  it("disappears once its end time has passed", () => {
    const now = Date.parse("2026-10-24T10:00:00Z");
    expect(specialStatus({ ends_at: "2026-10-24T10:00:01Z" }, now)).toBe("live");
    expect(specialStatus({ ends_at: "2026-10-24T10:00:00Z" }, now)).toBe("ended");
  });
});

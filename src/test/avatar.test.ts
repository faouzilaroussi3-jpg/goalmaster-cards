import { describe, expect, it } from "vitest";
import { cleanShirtName, clampNumber, DEFAULT_LOOK, lookError, lookFromRow } from "@/lib/avatar";
import { GOALMASTER_KIT, kitFor } from "@/lib/kits";

describe("avatar look rules", () => {
  it("only lets a player wear a club kit pulled from a pack", () => {
    expect(lookError({ ...DEFAULT_LOOK, club: "Real Madrid" }, [])).toMatch(/débloquer/);
    expect(lookError({ ...DEFAULT_LOOK, club: "Real Madrid" }, ["Real Madrid"])).toBeNull();
  });
  it("always allows the Goalmaster kit", () => {
    expect(lookError({ ...DEFAULT_LOOK, club: null }, [])).toBeNull();
    expect(kitFor(null)).toBe(GOALMASTER_KIT);
  });
  it("keeps shirt numbers between 1 and 99", () => {
    expect(clampNumber(0)).toBe(1);
    expect(clampNumber(150)).toBe(99);
    expect(lookError({ ...DEFAULT_LOOK, number: 100 }, [])).toMatch(/1 et 99/);
  });
  it("prints names in capitals, 12 letters max", () => {
    expect(cleanShirtName("mbappé123 junior jr")).toBe("MBAPPÉ JUNIO");
    expect(lookError({ ...DEFAULT_LOOK, shirtName: "ABCDEFGHIJKLM" }, [])).toMatch(/12/);
  });
  it("falls back to the default look for unknown saved values", () => {
    const look = lookFromRow({ user_id: "u", skin: "red", hair: "??", hair_color: "#123456", shoes: "x", shoe_color: "#ffffff", kit_club: null, shirt_name: "", shirt_number: 7 });
    expect(look.skin).toBe(DEFAULT_LOOK.skin);
    expect(look.hair).toBe(DEFAULT_LOOK.hair);
    expect(look.hairColor).toBe("#123456");
  });
});

describe("club kits", () => {
  it("matches name variants of the same club", () => {
    expect(kitFor("Real Madrid CF")).toEqual(kitFor("Real Madrid"));
    expect(kitFor("Paris Saint-Germain FC")).toEqual(kitFor("Paris SG"));
  });
  it("does not confuse Inter with AC Milan or Grêmio with Porto", () => {
    expect(kitFor("Inter Milan").shirt).not.toBe(kitFor("AC Milan").shirt);
    expect(kitFor("Gremio Foot-Ball Porto Alegrense").shirt).not.toBe(kitFor("Futebol Clube do Porto").shirt);
  });
  it("gives unknown clubs a stable kit", () => {
    expect(kitFor("FC Inconnu")).toEqual(kitFor("FC Inconnu"));
  });
});

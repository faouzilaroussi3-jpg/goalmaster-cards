import { describe, expect, it } from "vitest";
import { cleanInscription, DEFAULT_DESIGNS, designError, designOf, sameDesign, trophyNames } from "@/lib/trophy-design";

describe("Trophy designs", () => {
  it("a trophy keeps its original look until the admin saves one", () => {
    expect(designOf("ballon", [])).toEqual(DEFAULT_DESIGNS.ballon);
    expect(designOf("ballon", [])).toMatchObject({ inscription: "BALLON D'OR", diamonds: true });
  });
  it("a saved look replaces the original for that trophy only", () => {
    const rows = [{ kind: "most_wins", name: "Coupe des Champions", inscription: "VAINQUEUR", metal: "#d9dde3", base: "#0d0d0f", gem: "#2f6bff", accent: "#ff2d87", finish: "brosse", diamonds: true }];
    expect(designOf("most_wins", rows)).toMatchObject({ name: "Coupe des Champions", metal: "#d9dde3", finish: "brosse", diamonds: true });
    expect(designOf("ballon", rows)).toEqual(DEFAULT_DESIGNS.ballon);
    expect(trophyNames(rows)).toEqual({ ballon: "Ballon d'Or", rarest_card: "Trophée de la carte la plus rare", most_wins: "Coupe des Champions" });
  });
  it("names must be 3 to 40 characters", () => {
    expect(designError({ ...DEFAULT_DESIGNS.ballon, name: "  Coupe " })).toBeNull();
    expect(designError({ ...DEFAULT_DESIGNS.ballon, name: "Or" })).not.toBeNull();
    expect(designError({ ...DEFAULT_DESIGNS.ballon, name: "x".repeat(41) })).not.toBeNull();
  });
  it("engravings are capitals, 24 characters at most", () => {
    expect(cleanInscription("champion 2026")).toBe("CHAMPION 2026");
    expect(cleanInscription("a".repeat(30))).toHaveLength(24);
    expect(designError({ ...DEFAULT_DESIGNS.ballon, inscription: "A".repeat(25) })).not.toBeNull();
  });
  it("colours must be #rrggbb", () => {
    expect(designError({ ...DEFAULT_DESIGNS.ballon, metal: "gold" })).toBe("Couleur invalide");
    expect(designError({ ...DEFAULT_DESIGNS.ballon, gem: "#12345" })).toBe("Couleur invalide");
  });
  it("colour case does not count as a change", () => {
    expect(sameDesign(DEFAULT_DESIGNS.ballon, { ...DEFAULT_DESIGNS.ballon, metal: "#F4C542" })).toBe(true);
    expect(sameDesign(DEFAULT_DESIGNS.ballon, { ...DEFAULT_DESIGNS.ballon, diamonds: false })).toBe(false);
  });
});

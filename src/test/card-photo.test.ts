import { describe, expect, it } from "vitest";
import { fitWithin, isCardPhotoFile, rarityEffects } from "@/lib/card-photo";

describe("card photo uploads", () => {
  it("only serves random uuid image names", () => {
    expect(isCardPhotoFile("0b0e1f2a-3b4c-4d5e-8f60-718293a4b5c6.jpg")).toBe(true);
    expect(isCardPhotoFile("../secret.jpg")).toBe(false);
    expect(isCardPhotoFile("messi.jpg")).toBe(false);
    expect(isCardPhotoFile("0b0e1f2a-3b4c-4d5e-8f60-718293a4b5c6.png")).toBe(false);
  });

  it("shrinks big photos to fit 800x1200 without upscaling small ones", () => {
    expect(fitWithin(3000, 4500)).toEqual({ width: 800, height: 1200 });
    expect(fitWithin(400, 600)).toEqual({ width: 400, height: 600 });
  });
});

describe("automatic rarity effects", () => {
  it("SU gets fire and dragons", () => {
    expect(rarityEffects("secret_ultimate")).toEqual(expect.arrayContaining(["Rouge métallisé", "Feu réaliste", "Dragon cracheur de feu qui fait le tour"]));
  });
  it("SL classic gets diamonds, SL shiny gets navy/white neon", () => {
    expect(rarityEffects("secret_legendary")).toContain("Petits diamants qui gravitent");
    expect(rarityEffects("secret_legendary", "shiny")).toContain("Néon inversé bleu marine / blanc");
  });
  it("Legendary is gold, its ALT rainbow", () => {
    expect(rarityEffects("legendary")).toContain("Bordure dorée");
    expect(rarityEffects("legendary", "alt")).toContain("Bordure arc-en-ciel");
  });
});

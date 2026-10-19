import { describe, expect, it } from "vitest";
import clubs from "@/data/club-cards.json";

describe("club Légendaire cards", () => {
  it("adds 30 clubs", () => {
    expect(clubs).toHaveLength(30);
    expect(new Set(clubs.map((c) => c.name)).size).toBe(30);
  });
  it("are all Légendaire with an ALT edition", () => {
    for (const c of clubs) expect(c.rarity, c.name).toBe("legendary");
  });
  it("use the crest for the normal card and a different shirt photo for the ALT", () => {
    for (const c of clubs) {
      expect(c.image_url, c.name).toContain("_crest.jpg");
      expect(c.alt_image_url, c.name).toContain("_kit.jpg");
      expect(c.photo_source, c.name).not.toBe(c.alt_photo_source);
    }
  });
  it("credit both photos to a Wikimedia Commons source", () => {
    for (const c of clubs) {
      expect(c.photo_source, c.name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(c.alt_photo_source, c.name).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(c.photo_license && c.alt_photo_license, c.name).toBeTruthy();
    }
  });
});

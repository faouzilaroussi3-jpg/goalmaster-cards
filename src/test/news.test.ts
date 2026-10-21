import { describe, expect, it } from "vitest";
import { isSplashBlocked, shouldOpenSplash, unseenNews, type Announcement } from "@/lib/news";

const ann = (id: string, updated_at: string): Announcement => ({
  id, kind: "card", ref: null, title: id, body: null, item_count: 1, items: [], created_at: updated_at, updated_at,
});

describe("Nouveautés", () => {
  const list = [ann("b", "2026-10-21T12:00:00Z"), ann("a", "2026-10-20T12:00:00Z")];

  it("counts everything as new for a player who never opened the news", () => {
    expect(unseenNews(list, null).map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("only counts news updated after the last look", () => {
    expect(unseenNews(list, "2026-10-21T00:00:00Z").map((a) => a.id)).toEqual(["b"]);
    expect(unseenNews(list, "2026-10-22T00:00:00Z")).toEqual([]);
  });

  it("opens the welcome screen once per visit, and again when something new arrived", () => {
    expect(shouldOpenSplash({ unseen: 0, shownThisVisit: false, blockedRoute: false })).toBe(true);
    expect(shouldOpenSplash({ unseen: 0, shownThisVisit: true, blockedRoute: false })).toBe(false);
    expect(shouldOpenSplash({ unseen: 2, shownThisVisit: true, blockedRoute: false })).toBe(true);
  });

  it("never pops up while signing in or during a live match", () => {
    expect(isSplashBlocked("/auth")).toBe(true);
    expect(isSplashBlocked("/matchs/direct/123")).toBe(true);
    expect(isSplashBlocked("/matchs")).toBe(false);
    expect(shouldOpenSplash({ unseen: 3, shownThisVisit: false, blockedRoute: true })).toBe(false);
  });
});

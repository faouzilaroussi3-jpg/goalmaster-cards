import { describe, expect, it } from "vitest";
import { canSearch, cleanMessage, splitFriends, unreadTotal, type Friend } from "@/lib/friends";

const f = (o: Partial<Friend>): Friend => ({
  friendship_id: "x", user_id: "u", username: "a", level: 1, status: "accepted", incoming: false,
  unread: 0, last_message: null, last_at: null, last_from_me: null, created_at: "2026-01-01", ...o,
});

describe("friends rules", () => {
  it("rejects empty messages", () => {
    expect(cleanMessage("   ")).toBeNull();
  });
  it("accepts 500 characters but not 501", () => {
    expect(cleanMessage("a".repeat(500))).toHaveLength(500);
    expect(cleanMessage("a".repeat(501))).toBeNull();
  });
  it("trims messages before sending", () => {
    expect(cleanMessage("  salut  ")).toBe("salut");
  });
  it("needs at least 2 letters to search a player", () => {
    expect(canSearch("a")).toBe(false);
    expect(canSearch("ab")).toBe(true);
  });
  it("sorts requests into received, sent and friends", () => {
    const s = splitFriends([f({ status: "pending", incoming: true }), f({ status: "pending" }), f({})]);
    expect([s.incoming.length, s.outgoing.length, s.friends.length]).toEqual([1, 1, 1]);
  });
  it("counts unread messages only from accepted friends", () => {
    expect(unreadTotal([f({ unread: 3 }), f({ unread: 2, status: "pending", incoming: true })])).toBe(3);
  });
});

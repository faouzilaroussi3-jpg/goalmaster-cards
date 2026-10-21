import { describe, expect, it } from "vitest";
import { bidSteps, type BidRow } from "@/lib/transfer-market";

const bid = (id: string, amount: number, at: string): BidRow => ({ bid_id: id, username: id, amount, created_at: at, is_me: false });

describe("bid history", () => {
  it("lists bids newest first with how much each one raised the previous", () => {
    const steps = bidSteps([bid("a", 100, "2026-10-21T10:00:00Z"), bid("c", 160, "2026-10-21T10:02:00Z"), bid("b", 120, "2026-10-21T10:01:00Z")], 90);
    expect(steps.map((s) => [s.bid_id, s.amount, s.raise])).toEqual([["c", 160, 40], ["b", 120, 20], ["a", 100, 10]]);
  });
});

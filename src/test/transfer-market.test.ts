import { describe, expect, it } from "vitest";
import { AUCTION_DURATIONS, bidCost, formatTimeLeft, minBid, sellerPayout } from "@/lib/transfer-market";

describe("transfer market rules", () => {
  it("lets the seller choose 1 h, 6 h, 24 h or 3 days", () => {
    expect(AUCTION_DURATIONS.map((d) => d.hours)).toEqual([1, 6, 24, 72]);
  });

  it("keeps a 5% tax on each sale", () => {
    expect(sellerPayout(1000)).toBe(950);
    expect(sellerPayout(99)).toBe(94);
  });

  it("starts at the starting price, then needs +5% (at least +10 coins)", () => {
    expect(minBid(200, null)).toBe(200);
    expect(minBid(100, 100)).toBe(110);
    expect(minBid(100, 1000)).toBe(1050);
  });

  it("only charges the difference when raising your own winning bid", () => {
    expect(bidCost(500, 400, true)).toBe(100);
    expect(bidCost(500, 400, false)).toBe(500);
  });

  it("formats the time left", () => {
    expect(formatTimeLeft(0)).toBe("Terminée");
    expect(formatTimeLeft((2 * 86400 + 3 * 3600) * 1000)).toBe("2 j 3 h");
    expect(formatTimeLeft((4 * 3600 + 12 * 60) * 1000)).toBe("4 h 12 min");
    expect(formatTimeLeft((3 * 60 + 5) * 1000)).toBe("3 min 05 s");
  });
});

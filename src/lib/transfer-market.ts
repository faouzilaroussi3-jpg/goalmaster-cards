/** Transfer market rules shown in the UI. The database functions (auction_min_bid, auction_payout) enforce the same numbers. */

/** Auction lengths the seller can choose, in hours. */
export const AUCTION_DURATIONS = [
  { hours: 1, label: "1 h" },
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
  { hours: 72, label: "3 jours" },
] as const;

export const MIN_START_PRICE = 10;
/** Share of the final price the game keeps as a transfer tax. */
export const TRANSFER_TAX = 0.05;

/** Smallest valid next bid: the starting price, then +5% of the current bid (at least +10 coins). */
export function minBid(startPrice: number, currentBid: number | null): number {
  if (currentBid == null) return startPrice;
  return currentBid + Math.max(10, Math.ceil(currentBid * 0.05));
}

/** Coins the seller receives after the 5% tax. */
export function sellerPayout(amount: number): number {
  return Math.floor(amount * (1 - TRANSFER_TAX));
}

/** Coins actually taken from the bidder now (raising your own winning bid only costs the difference). */
export function bidCost(amount: number, currentBid: number | null, iLead: boolean): number {
  return iLead && currentBid != null ? amount - currentBid : amount;
}

/** "2 j 3 h", "4 h 12 min", "3 min 05 s", or "Terminée". */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Terminée";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min ${String(sec).padStart(2, "0")} s`;
}

export interface BidRow { bid_id: string; username: string | null; amount: number; created_at: string; is_me: boolean }

/** Bid history, newest first, with how much each bid raised the previous one (the first bid raises the start price). */
export function bidSteps(bids: BidRow[], startPrice: number): (BidRow & { raise: number })[] {
  const chrono = [...bids].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.amount - b.amount);
  return chrono.map((b, i) => ({ ...b, raise: b.amount - (i === 0 ? startPrice : chrono[i - 1]!.amount) })).reverse();
}

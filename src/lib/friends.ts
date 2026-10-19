/** Friends & messages rules shared by the UI; the database functions enforce the same limits. */

export const MESSAGE_MAX = 500;
export const SEARCH_MIN = 2;

export interface Friend {
  friendship_id: string;
  user_id: string;
  username: string;
  level: number;
  status: "pending" | "accepted";
  incoming: boolean;
  unread: number;
  last_message: string | null;
  last_at: string | null;
  last_from_me: boolean | null;
  created_at: string;
}

export interface FoundPlayer {
  user_id: string;
  username: string;
  level: number;
  relation: "none" | "friends" | "sent" | "received";
}

/** Trimmed message ready to send, or null when it is empty or too long. */
export function cleanMessage(body: string): string | null {
  const t = body.trim();
  if (t.length === 0 || t.length > MESSAGE_MAX) return null;
  return t;
}

export function canSearch(q: string) {
  return q.trim().length >= SEARCH_MIN;
}

export function splitFriends(list: Friend[]) {
  return {
    friends: list.filter((f) => f.status === "accepted"),
    incoming: list.filter((f) => f.status === "pending" && f.incoming),
    outgoing: list.filter((f) => f.status === "pending" && !f.incoming),
  };
}

/** Unread messages only count from accepted friends. */
export function unreadTotal(list: Friend[]) {
  return list.reduce((s, f) => s + (f.status === "accepted" ? Number(f.unread) || 0 : 0), 0);
}

export function shortTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

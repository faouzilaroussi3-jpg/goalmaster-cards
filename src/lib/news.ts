/** Nouveautés (welcome screen + notifications): pure rules shared by the header badge and the splash screen. */

export interface Announcement {
  id: string;
  kind: "card" | "rarity" | "pack";
  ref: string | null;
  title: string;
  body: string | null;
  item_count: number;
  items: unknown[];
  created_at: string;
  updated_at: string;
}

/** News the player has not seen yet (never seen = everything counts). */
export function unseenNews(list: Announcement[], seenAt: string | null): Announcement[] {
  if (!seenAt) return list;
  const t = Date.parse(seenAt);
  return list.filter((a) => Date.parse(a.updated_at) > t);
}

/** The welcome screen opens once per visit, and again whenever something new arrived since the last look. */
export function shouldOpenSplash(opts: { unseen: number; shownThisVisit: boolean; blockedRoute: boolean }): boolean {
  if (opts.blockedRoute) return false;
  return opts.unseen > 0 || !opts.shownThisVisit;
}

/** Routes where the welcome screen must never pop up over the action (signing in, playing a live match). */
export function isSplashBlocked(pathname: string): boolean {
  return pathname.startsWith("/auth") || pathname.startsWith("/matchs/direct");
}

export const SPLASH_SESSION_KEY = "gm-news-shown";
export const SLIDE_MS = 6000;

/** Game modes advertised on the welcome screen; `isNew` adds the NOUVEAU ribbon. */
export const GAME_MODES = [
  { key: "live", title: "Matchs joués à la main", text: "Dirige tes pions en 11 contre 11 : passe, profondeur, centre, tir. Contre l'ordi ou un ami en direct.", to: "/matchs", isNew: true },
  { key: "manager", title: "Matchs 11 contre 11", text: "Compose ton équipe, trouve le meilleur collectif et affronte les autres managers.", to: "/matchs/equipe", isNew: true },
  { key: "duels", title: "Duels tactiques", text: "5 cartes, 5 manches à thème, des choix secrets : grimpe au classement.", to: "/duels", isNew: false },
  { key: "transferts", title: "Transferts", text: "Mets tes cartes aux enchères et chasse les meilleures affaires.", to: "/transferts", isNew: false },
  { key: "defis", title: "Défis quotidiens", text: "Chaque jour et chaque semaine, des packs et des pièces à gagner.", to: "/defis", isNew: false },
] as const;

// Tiny store so the header button and the root-mounted splash share one open/closed state.
let open = false;
const listeners = new Set<() => void>();
export const newsSplash = {
  get: () => open,
  set(v: boolean) { if (open === v) return; open = v; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

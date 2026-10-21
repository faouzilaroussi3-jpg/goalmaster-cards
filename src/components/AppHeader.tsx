import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Coins, Package, LogOut, Shield, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isMuted, setMuted, sfx, subscribeMuted } from "@/lib/sfx";
import { useAuth, useFriends, useMyChallenges, useMyDuels, useMyLiveMatches, useMyMatches, useMyPacks, useMyPeriodicChallenges, useProfile } from "@/lib/auth";
import { splitFriends, unreadTotal } from "@/lib/friends";
import { claimableSummary } from "@/lib/challenges";
import { periodicSummary } from "@/lib/periodic-challenges";
import { giftSummary } from "@/lib/admin-grants";
import { newsSplash, unseenNews } from "@/lib/news";
import { useNews } from "@/lib/news-query";

const linkCls = "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground";
const activeCls = { className: "text-primary" };

export function AppHeader() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: packs } = useMyPacks();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const totalPacks = packs?.reduce((s, p) => s + p.count, 0) ?? 0;
  const { data: challenges } = useMyChallenges();
  const { data: periodic } = useMyPeriodicChallenges();
  const ready = claimableSummary(challenges ?? []).count + periodicSummary(periodic ?? []).count;
  const { data: duels } = useMyDuels();
  const duelTodo = (duels ?? []).filter((d) => d.my_turn || d.incoming).length;
  const { data: matches } = useMyMatches();
  const { data: liveMatches } = useMyLiveMatches();
  const matchTodo = (matches ?? []).filter((m) => m.needs_me).length + (liveMatches ?? []).filter((m) => m.incoming).length;
  const uid = session?.user.id;
  const { data: friendList } = useFriends();
  const friendTodo = splitFriends(friendList ?? []).incoming.length;
  const unread = unreadTotal(friendList ?? []);
  const { data: news } = useNews();
  const newsCount = news ? unseenNews(news.list, news.seenAt).length : 0;
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Friends + messages realtime: RLS only delivers rows where I am one of the two players.
  useEffect(() => {
    if (!uid) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["friends"] });
    const channel = supabase
      .channel(`social-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, (p) => {
        refresh();
        const row = p.new as { requester_id?: string; addressee_id?: string; status?: string } | null;
        if (p.eventType === "INSERT" && row?.addressee_id === uid) {
          sfx.friendRequest();
          toast("Nouvelle demande d'ami", { action: { label: "Voir", onClick: () => navigate({ to: "/amis" }) } });
        } else if (p.eventType === "UPDATE" && row?.status === "accepted" && row.requester_id === uid) {
          sfx.friendAccept();
          toast("Demande d'ami acceptée !");
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        refresh();
        qc.invalidateQueries({ queryKey: ["messages"] });
        const row = p.new as { sender_id?: string; recipient_id?: string } | null;
        if (p.eventType === "INSERT" && row?.recipient_id === uid) {
          sfx.messageIn();
          if (!pathRef.current.startsWith("/messages")) {
            toast("Nouveau message", { action: { label: "Lire", onClick: () => navigate({ to: "/messages", search: row.sender_id ? { ami: row.sender_id } : {} }) } });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc, navigate]);

  // Admin gifts: announce unseen gifts on load and live when the admin sends one (RLS only delivers my rows).
  useEffect(() => {
    if (!uid) return;
    let busy = false;
    const announce = async () => {
      if (busy) return;
      busy = true;
      const { data } = await supabase.rpc("claim_gift_notices");
      busy = false;
      if (!data?.length) return;
      sfx.sparkle();
      setTimeout(() => sfx.coins(5), 250);
      for (const g of data) {
        toast.success("Cadeau de l'admin !", { description: [giftSummary(g), g.note && `« ${g.note} »`].filter(Boolean).join(" — "), duration: 8000 });
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["packs"] });
      qc.invalidateQueries({ queryKey: ["my-cards"] });
    };
    announce();
    const channel = supabase
      .channel(`gifts-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_grants", filter: `user_id=eq.${uid}` }, () => { announce(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);

  // Nouveautés: new packs / cards / rarities are announced live to everyone signed in.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`news-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
        qc.invalidateQueries({ queryKey: ["news"] });
        const row = p.new as { title?: string; body?: string | null } | null;
        if (!row?.title) return;
        sfx.sparkle();
        toast(row.title, { description: row.body ?? undefined, duration: 9000, action: { label: "Voir", onClick: () => newsSplash.set(true) } });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);

  // One realtime subscription for the whole app: any change on my duels refreshes duel lists and boards.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`duels-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => {
        qc.invalidateQueries({ queryKey: ["duels"] });
        qc.invalidateQueries({ queryKey: ["duel"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["match"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_matches" }, (p) => {
        qc.invalidateQueries({ queryKey: ["live-matches"] });
        qc.invalidateQueries({ queryKey: ["live-match"] });
        const row = p.new as { id?: string; away_id?: string; mode?: string } | null;
        if (p.eventType === "INSERT" && row?.mode === "live" && row.away_id === uid && row.id) {
          const id = row.id;
          sfx.friendRequest();
          toast("Un ami te défie en direct !", { duration: 15000, action: { label: "Jouer", onClick: () => navigate({ to: "/matchs/direct/$matchId", params: { matchId: id } }) } });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc, navigate]);

  const duelLink = (
    <Link to="/duels" className={linkCls} activeProps={activeCls}>
      Duels
      {duelTodo > 0 && (
        <span aria-label={`${duelTodo} duel${duelTodo > 1 ? "s" : ""} en attente de toi`} className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {duelTodo}
        </span>
      )}
    </Link>
  );
  const matchLink = (
    <Link to="/matchs" className={linkCls} activeProps={activeCls}>
      Matchs
      {matchTodo > 0 && (
        <span aria-label={`${matchTodo} match${matchTodo > 1 ? "s" : ""} en attente de toi`} className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {matchTodo}
        </span>
      )}
    </Link>
  );
  const defis = (
    <Link to="/defis" className={linkCls} activeProps={activeCls}>
      Défis
      {ready > 0 && (
        <span aria-label={`${ready} récompense${ready > 1 ? "s" : ""} à récupérer`} className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {ready}
        </span>
      )}
    </Link>
  );

  const badge = (n: number, label: string) =>
    n > 0 && (
      <span aria-label={label} className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
        {n > 99 ? "99+" : n}
      </span>
    );
  const amis = (
    <Link to="/amis" className={linkCls} activeProps={activeCls}>
      Amis{badge(friendTodo, `${friendTodo} demande${friendTodo > 1 ? "s" : ""} d'ami reçue${friendTodo > 1 ? "s" : ""}`)}
    </Link>
  );
  const messages = (
    <Link to="/messages" className={linkCls} activeProps={activeCls}>
      Messages{badge(unread, `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`)}
    </Link>
  );

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/" className="font-display text-2xl tracking-widest text-gold sm:text-3xl">
          GOALMASTER
        </Link>
        <nav className="hidden flex-1 items-center gap-0.5 2xl:flex">
          <Link to="/packs" className={linkCls} activeProps={activeCls}>Packs</Link>
          <Link to="/collection" className={linkCls} activeProps={activeCls}>Ma collection</Link>
          <Link to="/transferts" className={linkCls} activeProps={activeCls}>Transferts</Link>
          {session && defis}
          {session && duelLink}
          {session && matchLink}
          {session && amis}
          {session && messages}
          <Link to="/leaderboard" className={linkCls} activeProps={activeCls}>Classement</Link>
          {session && <Link to="/profile" className={linkCls} activeProps={activeCls}>Profil</Link>}
          {profile?.isAdmin && (
            <Link to="/admin" className={linkCls} activeProps={activeCls}><Shield className="inline h-4 w-4" /> Admin</Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          {session ? (
            <>
              <button type="button" onClick={() => newsSplash.set(true)} aria-label={newsCount ? `${newsCount} nouveauté${newsCount > 1 ? "s" : ""}` : "Nouveautés"} title="Nouveautés"
                className="relative rounded-full p-2 text-muted-foreground transition hover:text-foreground">
                <Bell className={newsCount ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                {newsCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{newsCount > 9 ? "9+" : newsCount}</span>
                )}
              </button>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-primary">
                <Coins className="h-4 w-4" /> {profile?.coins ?? "…"}
              </span>
              <Link to="/packs" className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-foreground">
                <Package className="h-4 w-4 text-primary" /> {totalPacks}
              </Link>
              <button onClick={signOut} aria-label="Se déconnecter" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-primary-foreground">
              Connexion
            </Link>
          )}
        </div>
      </div>
      <nav className="flex justify-between overflow-x-auto border-t border-border px-1 py-1 2xl:hidden [&>a]:shrink-0 [&>a]:px-2">
        <Link to="/packs" className={linkCls} activeProps={activeCls}>Packs</Link>
        <Link to="/collection" className={linkCls} activeProps={activeCls}>Collection</Link>
        <Link to="/transferts" className={linkCls} activeProps={activeCls}>Transferts</Link>
        {session && defis}
        {session && duelLink}
        {session && matchLink}
        {session && amis}
        {session && messages}
        <Link to="/leaderboard" className={linkCls} activeProps={activeCls}>Classement</Link>
        {session && <Link to="/profile" className={linkCls} activeProps={activeCls}>Profil</Link>}
        {profile?.isAdmin && <Link to="/admin" className={linkCls} activeProps={activeCls}>Admin</Link>}
      </nav>
    </header>
  );
}

function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  return (
    <button
      type="button"
      data-sfx="none"
      onClick={() => { setMuted(!muted); if (muted) setTimeout(() => sfx.select(), 30); }}
      aria-label={muted ? "Activer les sons" : "Couper les sons"}
      title={muted ? "Activer les sons" : "Couper les sons"}
      className="rounded-full p-2 text-muted-foreground transition hover:text-foreground"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
    </button>
  );
}

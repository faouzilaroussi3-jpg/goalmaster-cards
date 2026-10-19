import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Package, LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyChallenges, useMyPacks, useProfile } from "@/lib/auth";
import { claimableSummary } from "@/lib/challenges";

const linkCls = "rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground";
const activeCls = { className: "text-primary" };

export function AppHeader() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: packs } = useMyPacks();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const totalPacks = packs?.reduce((s, p) => s + p.count, 0) ?? 0;
  const { data: challenges } = useMyChallenges();
  const ready = claimableSummary(challenges ?? []).count;
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
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          <Link to="/packs" className={linkCls} activeProps={activeCls}>Packs</Link>
          <Link to="/collection" className={linkCls} activeProps={activeCls}>Ma collection</Link>
          <Link to="/transferts" className={linkCls} activeProps={activeCls}>Transferts</Link>
        {session && defis}
          {session && defis}
          <Link to="/leaderboard" className={linkCls} activeProps={activeCls}>Classement</Link>
          {session && <Link to="/profile" className={linkCls} activeProps={activeCls}>Profil</Link>}
          {profile?.isAdmin && (
            <Link to="/admin" className={linkCls} activeProps={activeCls}><Shield className="inline h-4 w-4" /> Admin</Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {session ? (
            <>
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
      <nav className="flex justify-between overflow-x-auto border-t border-border px-1 py-1 md:hidden [&>a]:shrink-0 [&>a]:px-2">
        <Link to="/packs" className={linkCls} activeProps={activeCls}>Packs</Link>
        <Link to="/collection" className={linkCls} activeProps={activeCls}>Collection</Link>
        <Link to="/transferts" className={linkCls} activeProps={activeCls}>Transferts</Link>
        {session && defis}
        <Link to="/leaderboard" className={linkCls} activeProps={activeCls}>Classement</Link>
        {session && <Link to="/profile" className={linkCls} activeProps={activeCls}>Profil</Link>}
        {profile?.isAdmin && <Link to="/admin" className={linkCls} activeProps={activeCls}>Admin</Link>}
      </nav>
    </header>
  );
}

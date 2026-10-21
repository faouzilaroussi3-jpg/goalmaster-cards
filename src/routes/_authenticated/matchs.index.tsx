import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Brain, Clock, Globe, Shirt, Swords, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyMatches, type MyMatch } from "@/lib/auth";
import { BENCH_SIZE, DAILY_REWARDED_MATCHES, HALFTIME_TIMEOUT_HOURS, INVITE_TIMEOUT_HOURS, MAX_SUBS } from "@/lib/manager";
import { formatTimeLeft } from "@/lib/transfer-market";
import { Button } from "@/components/ui/button";
import { NewMatchDialog } from "@/components/match/NewMatchDialog";
import { MatchLeaderboard } from "@/components/MatchLeaderboard";
import { PlayYourself } from "@/components/match/PlayYourself";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/matchs/")({
  head: () => ({
    meta: [
      { title: "Matchs 11 contre 11 — Goalmaster" },
      { name: "description", content: "Deviens manager : compose ton équipe de 11, affronte l'équipe d'un autre joueur et regarde le match en direct sur le terrain." },
      { property: "og:title", content: "Matchs 11 contre 11 — Goalmaster" },
      { property: "og:description", content: "Le meilleur collectif et le meilleur général gagnent : à toi de bâtir l'équipe parfaite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

interface OpenMatch { match_id: string; home_id: string; home_name: string; home_rating: number; home_general: number; formation: string; created_at: string }

function MatchesPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: matches = [], isLoading } = useMyMatches();
  const { data: myTeam, isLoading: teamLoading } = useQuery({
    queryKey: ["manager-team", uid],
    queryFn: async () => (await supabase.from("manager_teams").select("formation, updated_at").eq("user_id", uid).maybeSingle()).data,
  });
  const { data: open = [] } = useQuery({
    queryKey: ["matches", "open"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_open_matches");
      if (error) throw error;
      return (data ?? []) as OpenMatch[];
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["matches", "stats", uid],
    queryFn: async () => (await supabase.from("match_stats").select("*").eq("user_id", uid).maybeSingle()).data,
  });
  const [creating, setCreating] = useState(false);

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_match", { _match_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      navigate({ to: "/matchs/$matchId", params: { matchId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const leave = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("leave_match", { _match_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const halftime = matches.filter((m) => m.status === "halftime");
  const incoming = matches.filter((m) => m.incoming);
  const waiting = matches.filter((m) => m.status === "pending" && m.is_home);
  const done = matches.filter((m) => m.status === "finished").slice(0, 16);
  const noTeam = !teamLoading && !myTeam;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl text-gold">Matchs 11 contre 11</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tu es le manager : compose ton équipe de 11 avec le meilleur général et le meilleur collectif, puis affronte l'équipe d'un autre joueur. Le match se joue sur le terrain en deux mi-temps de 1 min 20.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-secondary px-4 py-2 text-center">
            <div className="font-display text-2xl text-primary">{stats?.rating ?? 1000}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stats ? `${stats.wins} V · ${stats.draws} N · ${stats.losses} D` : "Points de manager"}
            </div>
          </div>
          <Button asChild variant="secondary" className="h-auto px-4 py-2.5 font-display text-lg">
            <Link to="/matchs/equipe"><Shirt className="h-4 w-4" /> Mon équipe</Link>
          </Button>
          <Button disabled={noTeam} onClick={() => setCreating(true)} className="h-auto bg-gold px-5 py-2.5 font-display text-lg text-primary-foreground shadow-gold">
            <Swords className="h-4 w-4" /> Nouveau match
          </Button>
        </div>
      </div>

      {noTeam && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/60 bg-primary/10 p-4">
          <p className="text-sm"><b>Première étape :</b> compose ton équipe de 11 titulaires et jusqu'à {BENCH_SIZE} remplaçants.</p>
          <Button asChild className="bg-gold text-primary-foreground"><Link to="/matchs/equipe">Composer mon équipe</Link></Button>
        </div>
      )}

      <PlayYourself noTeam={noTeam} />

      <Rules />

      {isLoading && <p className="mt-8 text-muted-foreground">Chargement…</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Mi-temps" empty="Aucun match à la pause." items={halftime} render={(m) => (
          <MatchRow key={m.match_id} m={m} highlight={m.needs_me}
            status={m.needs_me ? "à toi de faire tes changements" : m.they_ready ? "prêt, 2e mi-temps imminente" : "en attente des choix de l'adversaire"}
            deadline={m.halftime_at ? new Date(m.halftime_at).getTime() + HALFTIME_TIMEOUT_HOURS * 3600_000 : null}
            action={<Button asChild size="sm" className="bg-gold text-primary-foreground"><Link to="/matchs/$matchId" params={{ matchId: m.match_id }}>{m.needs_me ? "Regarder" : "Voir"}</Link></Button>} />
        )} />
        <Section title="Invitations reçues" empty="Personne ne t'a encore défié." items={incoming} render={(m) => (
          <MatchRow key={m.match_id} m={m} highlight status={`t'a défié · équipe ${m.their_general ?? "?"} de général`}
            action={<div className="flex gap-1.5">
              <Button size="sm" variant="ghost" disabled={leave.isPending} onClick={() => leave.mutate(m.match_id)}>Refuser</Button>
              <Button size="sm" className="bg-gold text-primary-foreground" disabled={accept.isPending || noTeam} onClick={() => accept.mutate(m.match_id)}>Jouer</Button>
            </div>} />
        )} />
        <Section title="En attente" empty="Aucun défi en attente." items={waiting} render={(m) => (
          <MatchRow key={m.match_id} m={m} status={m.open_invite ? "défi ouvert publié" : "invitation envoyée"}
            deadline={new Date(m.created_at).getTime() + INVITE_TIMEOUT_HOURS * 3600_000}
            action={<Button size="sm" variant="ghost" disabled={leave.isPending} onClick={() => leave.mutate(m.match_id)}>Annuler</Button>} />
        )} />
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide"><Globe className="h-5 w-5 text-primary" /> Défis ouverts</h2>
          {!open.length ? <p className="text-sm text-muted-foreground">Aucun défi ouvert pour l'instant. Lance le tien !</p> : (
            <ul className="space-y-2">
              {open.map((o) => (
                <li key={o.match_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">
                    <b>{o.home_name}</b> <span className="text-xs text-muted-foreground">{o.home_rating} pts · {o.formation} · général {o.home_general}</span>
                  </span>
                  <Button size="sm" className="bg-gold text-primary-foreground" disabled={accept.isPending || noTeam} onClick={() => accept.mutate(o.match_id)}>Relever</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide"><Trophy className="h-5 w-5 text-primary" /> Derniers matchs</h2>
        {!done.length ? <p className="text-sm text-muted-foreground">Pas encore de match terminé.</p> : (
          <ul className="grid gap-2 md:grid-cols-2">
            {done.map((m) => (
              <MatchRow key={m.match_id} m={m} tone={m.result ?? undefined}
                status={`${m.result === "win" ? "Victoire" : m.result === "loss" ? "Défaite" : "Match nul"} · ${m.my_goals}-${m.their_goals}`}
                action={<div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-primary">+{m.my_reward ?? 0}</span>
                  <span className={cn("tabular-nums", (m.my_elo_delta ?? 0) >= 0 ? "text-r-uncommon" : "text-destructive")}>{(m.my_elo_delta ?? 0) >= 0 ? "+" : ""}{m.my_elo_delta ?? 0} pts</span>
                  <Button asChild size="sm" variant="ghost"><Link to="/matchs/$matchId" params={{ matchId: m.match_id }}>Revoir</Link></Button>
                </div>} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl tracking-wide">Classement des managers</h2>
        <div className="panel p-4"><MatchLeaderboard limit={10} /></div>
      </section>

      <NewMatchDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Section({ title, empty, items, render }: { title: string; empty: string; items: MyMatch[]; render: (m: MyMatch) => ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide">
        {title} {items.length > 0 && <span className="rounded-full bg-primary px-2 text-sm text-primary-foreground">{items.length}</span>}
      </h2>
      {!items.length ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">{items.map(render)}</ul>}
    </section>
  );
}

function MatchRow({ m, status, action, highlight, tone, deadline }: { m: MyMatch; status: string; action: ReactNode; highlight?: boolean; tone?: string | undefined; deadline?: number | null }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
      highlight ? "border-primary/70 shadow-gold" : "border-border",
      tone === "win" && "border-r-uncommon/50", tone === "loss" && "opacity-75")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{m.opponent_name ?? (m.open_invite ? "Défi ouvert" : "?")}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {status}
          {deadline && deadline > Date.now() && <><Clock className="ml-1 h-3 w-3" /> {formatTimeLeft(deadline - Date.now())}</>}
        </p>
      </div>
      {action}
    </li>
  );
}

function Rules() {
  return (
    <details className="mt-6 rounded-xl border border-border bg-card p-4 [&_summary]:cursor-pointer">
      <summary className="flex items-center gap-2 font-display text-xl tracking-wide"><Brain className="h-5 w-5 text-primary" /> Comment jouer</summary>
      <ul className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <li><b className="text-foreground">Ton équipe :</b> une formation, 11 titulaires différents et jusqu'à {BENCH_SIZE} remplaçants, tirés de ta collection. Les cartes Club et Secrète Ultime ne jouent pas.</li>
        <li><b className="text-foreground">Note en match :</b> note du joueur + rareté (jusqu'à +5) + 2 pour une ALT ou Shiny + collectif. À son poste : normal. Poste proche : −3. Autre poste : −10. Gardien hors des cages ou joueur de champ dans les cages : −30.</li>
        <li><b className="text-foreground">Collectif :</b> jusqu'à +4 par joueur. 1 coéquipier du même club +1, 2 ou plus +2. 2 ou 3 compatriotes +1, 4 ou plus +2. Un joueur à un mauvais poste n'a pas de collectif.</li>
        <li><b className="text-foreground">Le match :</b> le milieu décide qui attaque, l'attaque contre la défense et le gardien décident si c'est but. Chaque ligne en plus dans ta formation lui donne +2.</li>
        <li><b className="text-foreground">Mi-temps :</b> jusqu'à {MAX_SUBS} changements et une nouvelle tactique (offensive, équilibrée, défensive). Si tu ne choisis pas en {HALFTIME_TIMEOUT_HOURS} h, ton équipe reste la même.</li>
        <li><b className="text-foreground">Récompenses :</b> victoire 150 pièces, nul 60, défaite 30, pour tes {DAILY_REWARDED_MATCHES} premiers matchs de la journée. Les points de manager font le classement.</li>
      </ul>
    </details>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Brain, Clock, Globe, Swords, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyDuels, type MyDuel } from "@/lib/auth";
import { DAILY_REWARDED_DUELS, DECK_BUDGET, DUEL_COST, ROUND_TIMEOUT_HOURS } from "@/lib/duel";
import { RARITIES } from "@/lib/rarity";
import { formatTimeLeft } from "@/lib/transfer-market";
import { Button } from "@/components/ui/button";
import { NewDuelDialog } from "@/components/duel/NewDuelDialog";
import { AcceptDuelDialog } from "@/components/duel/AcceptDuelDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/duels/")({
  head: () => ({
    meta: [
      { title: "Duels — Goalmaster" },
      { name: "description", content: "Défie les autres joueurs en duel tactique : 5 cartes, 5 manches à thème, choisis la bonne carte au bon moment." },
      { property: "og:title", content: "Duels tactiques — Goalmaster" },
      { property: "og:description", content: "Compose ton équipe de 5 cartes et bats les autres collectionneurs, manche par manche." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DuelsPage,
});

interface OpenDuel { duel_id: string; challenger_id: string; challenger_name: string; challenger_rating: number; created_at: string }

function DuelsPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const { data: duels = [], isLoading } = useMyDuels();
  const { data: open = [] } = useQuery({
    queryKey: ["duels", "open"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_open_duels");
      if (error) throw error;
      return (data ?? []) as OpenDuel[];
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["duels", "stats", uid],
    queryFn: async () => (await supabase.from("duel_stats").select("*").eq("user_id", uid).maybeSingle()).data,
  });
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<{ id: string; challenger: string } | null>(null);

  const leave = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("leave_duel", { _duel_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duels"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const myTurn = duels.filter((d) => d.my_turn);
  const incoming = duels.filter((d) => d.incoming);
  const waiting = duels.filter((d) => (d.status === "active" && !d.my_turn) || (d.status === "pending" && d.is_challenger));
  const done = duels.filter((d) => d.status === "finished").slice(0, 15);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl text-gold">Duels</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Affronte les autres joueurs avec 5 cartes de ta collection. Chaque manche a un thème : choisis en secret la carte à jouer, la plus forte gagne la manche.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary px-4 py-2 text-center">
            <div className="font-display text-2xl text-primary">{stats?.rating ?? 1000}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stats ? `${stats.wins} V · ${stats.draws} N · ${stats.losses} D` : "Points de duel"}
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-auto bg-gold px-5 py-2.5 font-display text-lg text-primary-foreground shadow-gold">
            <Swords className="h-4 w-4" /> Nouveau duel
          </Button>
        </div>
      </div>

      <Rules />

      {isLoading && <p className="mt-8 text-muted-foreground">Chargement…</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="À toi de jouer" empty="Aucun duel n'attend ton coup." items={myTurn} render={(d) => (
          <DuelRow key={d.duel_id} d={d} status={`Manche ${d.round + 1}/5${d.they_played ? " · l'adversaire a joué" : ""}`} highlight
            action={<Button asChild size="sm" className="bg-gold text-primary-foreground"><Link to="/duels/$duelId" params={{ duelId: d.duel_id }}>Jouer</Link></Button>} />
        )} />
        <Section title="Invitations reçues" empty="Personne ne t'a encore défié." items={incoming} render={(d) => (
          <DuelRow key={d.duel_id} d={d} status="t'a défié" highlight
            action={<div className="flex gap-1.5">
              <Button size="sm" variant="ghost" disabled={leave.isPending} onClick={() => leave.mutate(d.duel_id)}>Refuser</Button>
              <Button size="sm" className="bg-gold text-primary-foreground" onClick={() => setAccepting({ id: d.duel_id, challenger: d.opponent_name ?? "?" })}>Accepter</Button>
            </div>} />
        )} />
        <Section title="En attente" empty="Aucun duel en attente." items={waiting} render={(d) => (
          <DuelRow key={d.duel_id} d={d}
            status={d.status === "pending" ? (d.open_invite ? "défi ouvert publié" : "invitation envoyée") : `Manche ${d.round + 1}/5 · en attente de son coup`}
            action={d.status === "pending"
              ? <Button size="sm" variant="ghost" disabled={leave.isPending} onClick={() => leave.mutate(d.duel_id)}>Annuler</Button>
              : <Button asChild size="sm" variant="secondary"><Link to="/duels/$duelId" params={{ duelId: d.duel_id }}>Voir</Link></Button>} />
        )} />
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide"><Globe className="h-5 w-5 text-primary" /> Défis ouverts</h2>
          {!open.length ? <p className="text-sm text-muted-foreground">Aucun défi ouvert pour l'instant. Lance le tien !</p> : (
            <ul className="space-y-2">
              {open.map((o) => (
                <li key={o.duel_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <span className="flex-1 truncate"><b>{o.challenger_name}</b> <span className="text-xs text-muted-foreground">{o.challenger_rating} pts</span></span>
                  <Button size="sm" className="bg-gold text-primary-foreground" onClick={() => setAccepting({ id: o.duel_id, challenger: o.challenger_name })}>Relever</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide"><Trophy className="h-5 w-5 text-primary" /> Derniers duels</h2>
        {!done.length ? <p className="text-sm text-muted-foreground">Pas encore de duel terminé.</p> : (
          <ul className="grid gap-2 md:grid-cols-2">
            {done.map((d) => (
              <DuelRow key={d.duel_id} d={d}
                status={`${d.result === "win" ? "Victoire" : d.result === "loss" ? "Défaite" : "Match nul"}${d.forfeit ? " (abandon)" : ""} · ${d.my_score}-${d.their_score}`}
                tone={d.result ?? undefined}
                action={<div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-primary">+{d.my_reward ?? 0}</span>
                  <span className={cn("tabular-nums", (d.my_elo_delta ?? 0) >= 0 ? "text-r-uncommon" : "text-destructive")}>{(d.my_elo_delta ?? 0) >= 0 ? "+" : ""}{d.my_elo_delta ?? 0} pts</span>
                  <Button asChild size="sm" variant="ghost"><Link to="/duels/$duelId" params={{ duelId: d.duel_id }}>Revoir</Link></Button>
                </div>} />
            ))}
          </ul>
        )}
      </section>

      <NewDuelDialog open={creating} onClose={() => setCreating(false)} />
      <AcceptDuelDialog duel={accepting} onClose={() => setAccepting(null)} />
    </div>
  );
}

function Section({ title, empty, items, render }: { title: string; empty: string; items: MyDuel[]; render: (d: MyDuel) => React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide">
        {title} {items.length > 0 && <span className="rounded-full bg-primary px-2 text-sm text-primary-foreground">{items.length}</span>}
      </h2>
      {!items.length ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">{items.map(render)}</ul>}
    </section>
  );
}

function DuelRow({ d, status, action, highlight, tone }: { d: MyDuel; status: string; action: React.ReactNode; highlight?: boolean; tone?: string }) {
  const deadline = d.status === "active" && d.round_started_at ? new Date(d.round_started_at).getTime() + ROUND_TIMEOUT_HOURS * 3600_000 : null;
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
      highlight ? "border-primary/70 shadow-gold" : "border-border",
      tone === "win" && "border-r-uncommon/50", tone === "loss" && "opacity-75")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {d.opponent_name ?? (d.open_invite ? "Défi ouvert" : "?")}
          {d.status === "active" && <span className="ml-2 font-display text-lg text-primary">{d.my_score} - {d.their_score}</span>}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {status}
          {deadline && <><Clock className="ml-1 h-3 w-3" /> {formatTimeLeft(deadline - Date.now())}</>}
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
        <li><b className="text-foreground">Ton équipe :</b> 5 joueurs différents, pour un budget de {DECK_BUDGET} points. Coût : {RARITIES.filter((r) => DUEL_COST[r.key]).map((r) => `${r.short} ${DUEL_COST[r.key]}`).join(", ")}. Les Secrètes Ultimes ne jouent pas.</li>
        <li><b className="text-foreground">5 manches à thème :</b> Attaque, Milieu, Défense, Gardien et Manche libre, dans un ordre tiré au sort et connu à l'avance.</li>
        <li><b className="text-foreground">Puissance :</b> note du joueur + bonus de rareté (jusqu'à +5) + 2 pour une ALT ou Shiny. Un joueur au bon poste pour la manche gagne +6. Un gardien perd 6 hors de sa manche, les joueurs de champ perdent 6 dans la manche Gardien. Les cartes Club ont +2 partout.</li>
        <li><b className="text-foreground">Choix secret :</b> chaque manche, vous choisissez une carte en même temps sans voir celle de l'autre. Chaque carte ne joue qu'une fois. Tu vois l'équipe adverse : à toi d'anticiper !</li>
        <li><b className="text-foreground">Récompenses :</b> victoire 100 pièces, nul 40, défaite 20 (0 en cas d'abandon), pour tes {DAILY_REWARDED_DUELS} premiers duels de la journée. Les points de duel comptent pour le classement.</li>
        <li><b className="text-foreground">Délais :</b> {ROUND_TIMEOUT_HOURS} h pour jouer chaque manche, sinon tu perds par abandon. Une invitation expire au bout de 48 h.</li>
      </ul>
    </details>
  );
}

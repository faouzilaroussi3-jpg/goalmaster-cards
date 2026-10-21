import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FastForward, Pause, Play, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_SUBS, matchClock, minuteOf, rateTeam, TACTICS, toCard,
  type HalfResult, type MatchView, type RatedTeam, type Tactic,
} from "@/lib/manager";
import { buildTimeline, type FeedItem, type TeamInput } from "@/lib/match-replay";
import { MatchBoard } from "@/components/match/MatchBoard";
import { LineupList, TeamStats } from "@/components/match/TeamSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/matchs/$matchId")({
  head: () => ({
    meta: [
      { title: "Match 11 contre 11 — Goalmaster" },
      { name: "description", content: "Regarde ton équipe affronter celle d'un autre manager sur le terrain, mi-temps par mi-temps." },
      { property: "og:title", content: "Match 11 contre 11 — Goalmaster" },
      { property: "og:description", content: "Deux mi-temps de 1 min 20, des changements à la pause : qui sera le meilleur manager ?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

const toInput = (t: RatedTeam): TeamInput => ({ formation: t.formation, players: t.players.map((p) => ({ slot: p.slot, name: p.name, line: p.line })) });

function MatchPage() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const { data: m, isLoading, error } = useQuery({
    queryKey: ["match", matchId],
    refetchInterval: (q) => (q.state.data?.status === "pending" || q.state.data?.status === "halftime" ? 10_000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_match", { _match_id: matchId });
      if (error) throw error;
      return data as unknown as MatchView;
    },
  });
  const act = useMutation({
    mutationFn: async (kind: "accept" | "leave") => {
      const { error } = kind === "accept"
        ? await supabase.rpc("accept_match", { _match_id: matchId })
        : await supabase.rpc("leave_match", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["match", matchId] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-muted-foreground">Chargement…</div>;
  if (error || !m) return <div className="mx-auto max-w-6xl px-4 py-8"><p>Match introuvable.</p><Link to="/matchs" className="text-primary">Retour aux matchs</Link></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/matchs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Matchs</Link>
      {m.status === "pending" || m.status === "cancelled" || m.status === "declined" || !m.first_half || !m.away.team ? (
        <div className="panel p-5">
          <h1 className="text-4xl text-gold">{m.home.name} {m.away.name ? `contre ${m.away.name}` : "· défi ouvert"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.status === "cancelled" ? "Ce match a été annulé." : m.status === "declined" ? "Le défi a été refusé." :
              m.side === "home" ? "En attente de ton adversaire. Le match se jouera dès qu'il accepte." : "Ce manager te défie avec cette équipe. Ton équipe enregistrée jouera."}
          </p>
          {m.home.team && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TeamStats team={m.home.team} />
              <LineupList players={m.home.team.players} />
            </div>
          )}
          {m.status === "pending" && (
            <div className="mt-4 flex gap-2">
              {m.side === "home" ? <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("leave")}>Annuler le défi</Button> : (
                <>
                  {m.side === "away" && <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("leave")}>Refuser</Button>}
                  <Button className="bg-gold text-primary-foreground" disabled={act.isPending} onClick={() => act.mutate("accept")}>Jouer le match</Button>
                </>
              )}
            </div>
          )}
        </div>
      ) : <Played m={m} />}
    </div>
  );
}

function Played({ m }: { m: MatchView }) {
  const seenKey = `mm-seen-${m.id}`;
  const [half, setHalf] = useState<1 | 2>(1);
  useEffect(() => {
    if (m.second_half && typeof localStorage !== "undefined" && localStorage.getItem(seenKey)) setHalf(2);
  }, [m.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const home = half === 1 ? m.home.team! : (m.home.team2 ?? m.home.team!);
  const away = half === 1 ? m.away.team! : (m.away.team2 ?? m.away.team!);
  const res: HalfResult | null = half === 1 ? m.first_half : m.second_half;
  const tl = useMemo(() => buildTimeline(toInput(home), toInput(away), res?.events ?? [], `${m.id}-${half}`, half === 1 ? "home" : "away"),
    [home, away, res, m.id, half]);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seek, setSeek] = useState({ t: 0 });
  const [t, setT] = useState(0);
  const lastFeed = useRef(0);
  useEffect(() => { setPlaying(false); setStarted(false); setEnded(false); setSeek({ t: 0 }); lastFeed.current = 0; }, [half, tl]);

  const base = half === 2 && m.first_half ? { home: m.first_half.home, away: m.first_half.away } : { home: 0, away: 0 };
  const shown = tl.feed.filter((f) => f.t <= t);
  const lastF = shown[shown.length - 1];
  const score = { home: base.home + (lastF?.home ?? 0), away: base.away + (lastF?.away ?? 0) };
  useEffect(() => {
    if (!playing) { lastFeed.current = shown.length; return; }
    for (const f of shown.slice(lastFeed.current)) { if (f.kind === "goal") sfx.goal(); else if (f.kind === "save") sfx.save(); }
    lastFeed.current = shown.length;
  }, [shown.length, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const flash = [...shown].reverse().find((f) => f.kind === "goal" && t - f.t < 2.4);

  const nameOf = (side: "home" | "away", slot: number | null) => {
    const team = side === "home" ? home : away;
    return slot == null ? "?" : (team.players.find((p) => p.slot === slot)?.name ?? "?");
  };
  const describe = (f: FeedItem) => {
    const opp = f.side === "home" ? "away" : "home";
    if (f.kind === "goal") return `BUT ! ${nameOf(f.side, f.shooter)}${f.assist != null ? ` (passe de ${nameOf(f.side, f.assist)})` : ""}`;
    if (f.kind === "save") return `Arrêt de ${nameOf(opp, f.keeper)} devant ${nameOf(f.side, f.shooter)}`;
    if (f.kind === "miss") return `${nameOf(f.side, f.shooter)} tire à côté`;
    return `${nameOf(opp, f.defender)} récupère le ballon devant ${nameOf(f.side, f.shooter)}`;
  };

  const finish = () => {
    setPlaying(false); setEnded(true);
    sfx.whistle(half === 2 ? 3 : 2);
    if (half === 1) localStorage.setItem(seenKey, "1");
  };
  const myTeam = m.side ? (m.side === "home" ? m.home.team! : m.away.team!) : null;
  const myReady = m.side ? m[m.side].ready : true;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
        <div className="flex items-center gap-3 font-display text-2xl tracking-wide sm:text-3xl">
          <span className="h-3 w-3 rounded-full bg-primary" /> {m.home.name}{m.side === "home" && <span className="text-xs text-muted-foreground">(toi)</span>}
          <span className="rounded-lg bg-secondary px-3 text-primary tabular-nums">{score.home} - {score.away}</span>
          {m.away.name}{m.side === "away" && <span className="text-xs text-muted-foreground">(toi)</span>} <span className="h-3 w-3 rounded-full bg-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl tabular-nums">{matchClock(half, t, tl.end)}</span>
          {m.second_half && ([1, 2] as const).map((h) => (
            <button key={h} type="button" data-sfx="tab" onClick={() => setHalf(h)} className={cn("rounded-full px-3 py-1 text-sm font-semibold", h === half ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              {h === 1 ? "1re" : "2e"} mi-temps
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <MatchBoard timeline={tl} playing={playing} speed={speed} seek={seek} onTick={setT} onEnd={finish} homeLabel={m.home.name ?? ""} awayLabel={m.away.name ?? ""} />
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <Button data-sfx="none" onClick={() => { sfx.whistle(); setStarted(true); setPlaying(true); }} className="h-auto bg-gold px-6 py-3 font-display text-2xl text-primary-foreground shadow-gold">
              <Play className="h-5 w-5" /> {half === 1 ? "Coup d'envoi" : "Lancer la 2e mi-temps"}
            </Button>
          </div>
        )}
        {flash && (
          <div key={flash.t} className="mm-goal-flash pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-6xl text-gold sm:text-8xl">BUT !</span>
            <span className="rounded bg-background/70 px-3 font-semibold">{nameOf(flash.side, flash.shooter)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!started || ended} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
        {[1, 2, 4].map((s) => (
          <Button key={s} size="sm" variant={speed === s ? "default" : "secondary"} onClick={() => setSpeed(s)}>x{s}</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => { setSeek({ t: 0 }); setEnded(false); setStarted(true); setPlaying(true); }}><RotateCcw className="h-4 w-4" /> Revoir</Button>
        <Button size="sm" variant="ghost" disabled={ended} onClick={() => { setStarted(true); setSeek({ t: tl.end }); finish(); }}><FastForward className="h-4 w-4" /> Passer la mi-temps</Button>
      </div>

      {ended && half === 1 && (
        m.second_half ? (
          <Button onClick={() => setHalf(2)} className="self-start bg-gold font-display text-lg text-primary-foreground">Voir la 2e mi-temps</Button>
        ) : m.status === "halftime" && myTeam && !myReady ? (
          <HalftimePanel matchId={m.id} team={myTeam} opponent={m.side === "home" ? m.away.team! : m.home.team!} />
        ) : m.status === "halftime" ? (
          <p className="rounded-lg bg-secondary p-3 text-sm">Tes choix sont validés. La 2e mi-temps se jouera dès que ton adversaire aura fait les siens (au plus tard 24 h après la pause).</p>
        ) : null
      )}
      {ended && half === 2 && m.status === "finished" && m.side && (
        <div className="panel p-4 text-center">
          <p className="font-display text-4xl text-gold">{m.winner_id == null ? "Match nul" : m.winner_id === m[m.side].id ? "Victoire !" : "Défaite"} · {m.home.goals} - {m.away.goals}</p>
          <p className="mt-1 text-sm">+{m[m.side].reward ?? 0} pièces · {(m[m.side].elo_delta ?? 0) >= 0 ? "+" : ""}{m[m.side].elo_delta ?? 0} points de manager</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <h2 className="mb-2 font-display text-xl">Le match</h2>
          {!shown.length ? <p className="text-sm text-muted-foreground">Rien pour l'instant.</p> : (
            <ul className="space-y-1 text-sm">
              {[...shown].reverse().map((f, i) => (
                <li key={i} className={cn(f.kind === "goal" && "font-bold text-primary")}>
                  <span className="mr-2 text-muted-foreground tabular-nums">{minuteOf(half, f.t, tl.end)}'</span>{describe(f)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel p-4"><h2 className="mb-2 font-display text-xl">{m.home.name}</h2><TeamStats team={home} compare={away} /><LineupList className="mt-3" players={home.players} /></div>
        <div className="panel p-4"><h2 className="mb-2 font-display text-xl">{m.away.name}</h2><TeamStats team={away} compare={home} /><LineupList className="mt-3" players={away.players} /></div>
      </div>
    </div>
  );
}

function HalftimePanel({ matchId, team, opponent }: { matchId: string; team: RatedTeam; opponent: RatedTeam }) {
  const qc = useQueryClient();
  const [tactic, setTactic] = useState<Tactic>(team.tactic);
  const [subs, setSubs] = useState<{ out: number; in: number }[]>([]);
  const xi = team.players.map(toCard);
  for (const s of subs) xi[s.out] = toCard(team.bench[s.in] as never);
  const preview = rateTeam(team.formation, tactic, xi, team.bench.filter((_, i) => !subs.some((s) => s.in === i)));
  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_halftime", { _match_id: matchId, _tactic: tactic, _subs: subs });
      if (error) throw error;
    },
    onSuccess: () => { sfx.success(); toast.success("Choix de mi-temps validés !"); qc.invalidateQueries({ queryKey: ["match", matchId] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="panel p-4">
      <h2 className="font-display text-3xl text-gold">Mi-temps : tes consignes</h2>
      <p className="text-sm text-muted-foreground">Jusqu'à {MAX_SUBS} changements et une nouvelle tactique. L'adversaire ne voit pas tes choix.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(TACTICS) as Tactic[]).map((k) => (
          <button key={k} type="button" data-sfx="tab" onClick={() => setTactic(k)} title={TACTICS[k].hint}
            className={cn("rounded-full px-3 py-1 text-sm font-semibold", k === tactic ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{TACTICS[k].label}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ul className="space-y-1">
          {team.players.map((p) => {
            const sub = subs.find((s) => s.out === p.slot);
            return (
              <li key={p.slot} className="flex items-center gap-2 rounded-md bg-secondary/50 px-2 py-1 text-sm">
                <span className="w-9 text-[11px] font-bold text-muted-foreground">{p.role}</span>
                <span className="min-w-0 flex-1 truncate">{sub ? <><s className="text-muted-foreground">{p.name}</s> → <b>{team.bench[sub.in]?.name}</b></> : p.name}</span>
                <select aria-label={`Remplacer ${p.name}`} className="h-8 rounded-md border border-input bg-background px-1 text-xs"
                  value={sub ? String(sub.in) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSubs((list) => {
                      const rest = list.filter((s) => s.out !== p.slot);
                      return v === "" ? rest : [...rest, { out: p.slot, in: Number(v) }];
                    });
                  }}>
                  <option value="">—</option>
                  {team.bench.map((b, i) => (subs.some((s) => s.in === i && s.out !== p.slot) || (!sub && subs.length >= MAX_SUBS)) ? null : (
                    <option key={i} value={i}>{b.name} ({b.pos} {b.rating})</option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
        <div>
          <TeamStats team={preview} compare={opponent} />
          <Button disabled={submit.isPending} onClick={() => submit.mutate()} className="mt-4 w-full bg-gold font-display text-lg text-primary-foreground">Valider la mi-temps</Button>
        </div>
      </div>
    </div>
  );
}

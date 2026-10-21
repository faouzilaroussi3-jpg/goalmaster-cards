import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Gamepad2, Keyboard, Pause, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { matchClock } from "@/lib/manager";
import {
  applySnap, BOT_LEVELS, botName, createGame, startGame, STEP, stepGame, toSnap,
  type Game, type GameEvent, type LiveMatchView, type PadInput, type Snap,
} from "@/lib/live-match";
import { CONTROL_HELP, Pad } from "@/lib/pad";
import { LiveBoard } from "@/components/match/LiveBoard";
import { TouchPad } from "@/components/match/TouchPad";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/matchs/direct/$matchId")({
  head: () => ({
    meta: [
      { title: "Match en direct — Goalmaster" },
      { name: "description", content: "Dirige tes pions toi-même : passe, passe en profondeur, centre et tir, au clavier, au tactile ou à la manette." },
      { property: "og:title", content: "Match en direct — Goalmaster" },
      { property: "og:description", content: "Joue ton équipe de 11 à la main contre l'ordi ou contre un ami en direct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const { data: m, isLoading, error } = useQuery({
    queryKey: ["live-match", matchId],
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 5_000 : q.state.data?.status === "playing" && q.state.data.mode === "live" ? 8_000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_live_match", { _match_id: matchId });
      if (error) throw error;
      return data as unknown as LiveMatchView;
    },
  });

  // Heartbeat so the other player can see I am still here (and claim the win if I vanish).
  const status = m?.status, mode = m?.mode;
  useEffect(() => {
    if (mode !== "live" || (status !== "pending" && status !== "playing")) return;
    const ping = async () => {
      const { data } = await supabase.rpc("live_ping", { _match_id: matchId });
      if (data && data !== status) qc.invalidateQueries({ queryKey: ["live-match", matchId] });
    };
    ping();
    const iv = setInterval(ping, 10_000);
    return () => clearInterval(iv);
  }, [matchId, status, mode, qc]);

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-muted-foreground">Chargement…</div>;
  if (error || !m) return <div className="mx-auto max-w-6xl px-4 py-8"><p>Match introuvable.</p><Link to="/matchs" className="text-primary">Retour aux matchs</Link></div>;
  if (m.status === "playing" && m.home.team && m.away.team) return <LiveGame key={m.id} m={m} />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/matchs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Matchs</Link>
      {m.status === "pending" ? <Pending m={m} /> : m.status === "finished" ? <Result m={m} /> : (
        <div className="panel p-5">
          <h1 className="text-4xl text-gold">{m.status === "declined" ? "Défi refusé" : "Match annulé"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{m.status === "declined" ? "Ton ami a refusé de jouer cette fois." : "Ce match n'a pas eu lieu."}</p>
        </div>
      )}
    </div>
  );
}

const names = (m: LiveMatchView) => ({ home: m.home.name ?? "?", away: m.mode === "bot" ? botName(m.bot_level) : (m.away.name ?? "?") });

function Pending({ m }: { m: LiveMatchView }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: async (kind: "accept" | "leave") => {
      const { error } = kind === "accept"
        ? await supabase.rpc("accept_live_match", { _match_id: m.id })
        : await supabase.rpc("leave_live_match", { _match_id: m.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["live-match", m.id] }); qc.invalidateQueries({ queryKey: ["live-matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const n = names(m);
  return (
    <div className="panel p-5">
      <h1 className="text-4xl text-gold">{n.home} contre {n.away}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {m.side === "home"
          ? `Invitation envoyée à ${n.away}. Le match commence dès qu'il accepte (l'invitation dure 10 minutes). Reste sur cette page.`
          : `${n.home} te défie en direct : vous dirigez vos pions en même temps, chacun sur son appareil.`}
      </p>
      <div className="mt-4 flex gap-2">
        {m.side === "home" ? (
          <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("leave")}>Annuler l'invitation</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("leave")}>Refuser</Button>
            <Button className="bg-gold text-primary-foreground" disabled={act.isPending} onClick={() => act.mutate("accept")}>Jouer maintenant</Button>
          </>
        )}
      </div>
      <ControlsHelp className="mt-6" />
    </div>
  );
}

function Result({ m }: { m: LiveMatchView }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const n = names(m);
  const me = m[m.side];
  const win = m.result === "draw" ? null : m.result === m.side;
  const again = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("start_bot_match", { _level: m.bot_level ?? "legendaire" });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["live-matches"] }); navigate({ to: "/matchs/direct/$matchId", params: { matchId: id } }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="panel p-6 text-center">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">{n.home} contre {n.away}</p>
      <p className="mt-2 font-display text-6xl text-gold">{win == null ? "Match nul" : win ? "Victoire !" : "Défaite"}</p>
      <p className="font-display text-4xl tabular-nums">{m.home.goals} - {m.away.goals}</p>
      <p className="mt-2 text-lg font-semibold text-primary">+{me.reward ?? 0} pièces</p>
      {me.reward === 0 && !m.forfeit_by && <p className="text-xs text-muted-foreground">Tu as déjà touché tes 5 matchs récompensés aujourd'hui.</p>}
      {m.forfeit_by && <p className="mt-1 text-sm text-muted-foreground">{m.forfeit_by === m.side ? "Tu as quitté le match : il compte comme perdu 3-0." : "Ton adversaire a quitté le match : victoire 3-0."}</p>}
      {m.disputed && <p className="mt-1 text-sm text-muted-foreground">Vos deux appareils n'ont pas envoyé le même score : le match compte comme nul.</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {m.mode === "bot" && <Button className="bg-gold text-primary-foreground" disabled={again.isPending} onClick={() => again.mutate()}>Rejouer contre l'ordi {BOT_LEVELS[m.bot_level ?? "legendaire"].label}</Button>}
        <Button asChild variant="secondary"><Link to="/matchs">Retour aux matchs</Link></Button>
      </div>
    </div>
  );
}

export function ControlsHelp({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 text-sm sm:grid-cols-2", className)}>
      {([["keyboard", "Clavier", Keyboard], ["gamepad", "Manette", Gamepad2]] as const).map(([k, title, Icon]) => (
        <div key={k}>
          <p className="mb-1 flex items-center gap-1.5 font-display text-lg tracking-wide"><Icon className="h-4 w-4 text-primary" /> {title}</p>
          <ul className="space-y-0.5">
            {CONTROL_HELP[k].map(([a, b]) => <li key={a} className="flex justify-between gap-3"><span className="text-muted-foreground">{a}</span><b className="text-right">{b}</b></li>)}
          </ul>
        </div>
      ))}
      <p className="text-muted-foreground sm:col-span-2">Sur téléphone et tablette : stick à gauche, boutons Passe, Tir, Profondeur, Centre, Sprint et Changer à droite.</p>
    </div>
  );
}

function playEvent(e: GameEvent) {
  if (e.kind === "kick") sfx.kick();
  else if (e.kind === "goal") sfx.goal();
  else if (e.kind === "save") sfx.save();
  else if (e.kind === "whistle") sfx.whistle(e.n ?? 1);
  else if (e.kind === "out") sfx.whistle(1);
  else if (e.kind === "steal") sfx.cardSlide();
  else if (e.kind === "post") sfx.gavel();
}

function LiveGame({ m }: { m: LiveMatchView }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session!.user.id;
  const role: "solo" | "host" | "guest" = m.mode === "bot" ? "solo" : m.side === "home" ? "host" : "guest";
  const n = names(m);
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) {
    gameRef.current = createGame(m.home.team!, m.away.team!, { human: { home: true, away: m.mode === "live" }, level: m.bot_level ?? "legendaire", seed: m.id });
  }
  const g = gameRef.current;
  const padRef = useRef<Pad | null>(null);
  if (!padRef.current) padRef.current = new Pad();
  const pad = padRef.current;
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [peerHere, setPeerHere] = useState(role === "solo");
  const peerRef = useRef(role === "solo");
  peerRef.current = peerHere;
  const [peerGoneAt, setPeerGoneAt] = useState<number | null>(null);
  const [touch, setTouch] = useState(false);
  const [help, setHelp] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remote = useRef<PadInput | null>(null);
  const snaps = useRef<{ a: Snap | null; b: Snap | null; at: number }>({ a: null, b: null, at: 0 });
  const lastEv = useRef(0);
  const reported = useRef(false);

  useEffect(() => {
    setTouch(window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard (physical keys) + pause; the gamepad is polled every frame by the pad itself.
  useEffect(() => {
    const togglePause = () => { if (role === "solo" && gameRef.current?.phase !== "ready") setPaused((p) => !p); };
    pad.onPause = togglePause;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select")) return;
      if (e.code === "Escape" || e.code === "KeyP") { togglePause(); return; }
      if (pad.keyDown(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => pad.keyUp(e.code);
    const blur = () => pad.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); pad.onPause = null; };
  }, [pad, role]);

  // Live match: one broadcast channel per match. The home player hosts the game, the away player sends his pad.
  useEffect(() => {
    if (role === "solo") return;
    const otherId = role === "host" ? m.away.id : m.home.id;
    const ch = supabase.channel(`live-match-${m.id}`, { config: { broadcast: { self: false, ack: false }, presence: { key: uid } } });
    ch.on("broadcast", { event: "input" }, ({ payload }) => { if (role === "host") remote.current = payload as PadInput; })
      .on("broadcast", { event: "snap" }, ({ payload }) => {
        if (role !== "guest") return;
        const s = snaps.current;
        s.a = s.b; s.b = payload as Snap; s.at = performance.now();
      })
      .on("presence", { event: "sync" }, () => {
        const here = otherId ? Object.prototype.hasOwnProperty.call(ch.presenceState(), otherId) : false;
        setPeerHere(here);
        setPeerGoneAt((t) => (here ? null : t ?? Date.now()));
      })
      .subscribe((st) => { if (st === "SUBSCRIBED") void ch.track({ side: m.side }); });
    channelRef.current = ch;
    return () => { channelRef.current = null; void supabase.removeChannel(ch); };
  }, [role, m.id, m.side, m.home.id, m.away.id, uid]);

  // Host: kick off as soon as the friend is connected.
  useEffect(() => {
    if (role === "host" && peerHere && g.phase === "ready") { startGame(g); sfx.whistle(); }
  }, [role, peerHere, g]);

  const report = async () => {
    setReportState("sending");
    const { error } = await supabase.rpc("report_live_result", { _match_id: m.id, _home: g.score.home, _away: g.score.away });
    if (error) { setReportState("error"); toast.error(error.message); return; }
    setReportState("sent");
    qc.invalidateQueries({ queryKey: ["live-match", m.id] });
    qc.invalidateQueries({ queryKey: ["live-matches"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, lastSnap = 0, lastSend = 0, lastKey = "";
    let guestReady = false;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const input = pad.read(now);
      if (role !== "guest") {
        if (!pausedRef.current) {
          acc += dt;
          while (acc >= STEP) {
            stepGame(g, role === "solo" ? { home: input } : { home: input, away: peerRef.current ? remote.current ?? undefined : undefined }, STEP);
            acc -= STEP;
          }
        } else acc = 0;
        if (role === "host" && now - lastSnap > 80) { lastSnap = now; void channelRef.current?.send({ type: "broadcast", event: "snap", payload: toSnap(g) }); }
      } else {
        const s = snaps.current;
        if (s.b) {
          if (!guestReady) { guestReady = true; lastEv.current = Math.max(0, ...s.b.e.map((e) => e.id)); }
          applySnap(g, s.a, s.b, Math.min(1, (now - s.at) / 80));
        }
        const key = JSON.stringify(input);
        if (now - lastSend > 50 && (key !== lastKey || now - lastSend > 250)) {
          lastSend = now; lastKey = key;
          void channelRef.current?.send({ type: "broadcast", event: "input", payload: input });
        }
      }
      for (const e of g.events) if (e.id > lastEv.current) { lastEv.current = e.id; playEvent(e); }
      if (g.phase === "ended" && !reported.current) { reported.current = true; void reportRef.current(); }
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g, pad, role]);

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_live_match", { _match_id: m.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["live-match", m.id] }); qc.invalidateQueries({ queryKey: ["live-matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("claim_live_forfeit", { _match_id: m.id });
      if (error) throw error;
    },
    onSuccess: () => { sfx.success(); qc.invalidateQueries({ queryKey: ["live-match", m.id] }); qc.invalidateQueries({ queryKey: ["live-matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const me = m.side;
  const goal = [...g.events].reverse().find((e) => e.kind === "goal" && e.half === g.half && g.t - e.t < 2.6 && g.phase !== "ended");
  const scorer = goal && goal.player >= 0 ? g.players[goal.player] : null;
  const owner = g.ball.owner >= 0 ? g.players[g.ball.owner] : null;
  const charging = owner && owner.side === me && g.ctrl[me] === owner.id && pad.isHeld("shot") && g.charge[me];
  const peerLost = role !== "solo" && peerGoneAt != null && g.phase !== "ready" && g.phase !== "ended";
  const canClaim = peerLost && Date.now() - peerGoneAt! > 25_000;

  return (
    <div className="lm-screen fixed inset-0 z-50 flex touch-none select-none flex-col bg-background" data-sfx="none">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 font-display text-lg tracking-wide sm:text-2xl">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate">{n.home}{me === "home" && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}</span>
          <span className="rounded-lg bg-secondary px-2.5 text-primary tabular-nums">{g.score.home} - {g.score.away}</span>
          <span className="truncate">{n.away}{me === "away" && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-display text-xl tabular-nums sm:text-2xl">{matchClock(g.half, g.t)}</span>
          {role === "solo" && g.phase !== "ready" && g.phase !== "ended" && (
            <Button size="icon" variant="secondary" aria-label={paused ? "Reprendre" : "Pause"} onClick={() => setPaused((p) => !p)}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
          )}
          <Button size="icon" variant="secondary" aria-label="Commandes" onClick={() => setHelp((h) => !h)}><Keyboard className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Quitter le match" onClick={() => (g.phase === "ended" ? undefined : setQuitting(true))} disabled={g.phase === "ended"}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-start justify-center p-2 sm:items-center">
        <div className="relative w-full" style={{ maxWidth: "calc((100dvh - 4.5rem) * 111 / 74)" }}>
          <LiveBoard game={g} mySide={me} homeLabel={n.home} awayLabel={n.away} />

          {charging && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 w-40 -translate-x-1/2 rounded-full bg-background/70 p-1">
              <div className="lm-power h-2 rounded-full" style={{ width: `${Math.round(pad.charge() * 100)}%` }} />
            </div>
          )}
          {goal && (
            <div key={goal.id} className="mm-goal-flash pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-6xl text-gold sm:text-8xl">BUT !</span>
              {scorer && <span className="rounded bg-background/70 px-3 font-semibold">{scorer.name}</span>}
            </div>
          )}
          {g.phase === "countdown" && (
            <Overlay><span className="font-display text-8xl text-gold tabular-nums">{Math.max(1, Math.ceil(g.phaseT))}</span></Overlay>
          )}
          {g.phase === "halftime" && (
            <Overlay><span className="font-display text-5xl text-gold">Mi-temps</span><span className="font-display text-3xl tabular-nums">{g.score.home} - {g.score.away}</span></Overlay>
          )}
          {g.phase === "ready" && (
            <Overlay>
              {role === "solo" ? (
                <>
                  <p className="font-display text-3xl">Contre l'{botName(m.bot_level)}</p>
                  <Button data-sfx="none" onClick={() => { sfx.whistle(); startGame(g); }} className="h-auto bg-gold px-6 py-3 font-display text-2xl text-primary-foreground shadow-gold">
                    <Play className="h-5 w-5" /> Coup d'envoi
                  </Button>
                  <p className="max-w-sm text-center text-xs text-muted-foreground">Tu diriges le pion entouré de rose. Passe sur le porteur du ballon (ou maintiens Tir tout près de lui) pour le récupérer.</p>
                </>
              ) : role === "host" ? (
                <p className="font-display text-2xl">En attente de {n.away}…</p>
              ) : (
                <p className="font-display text-2xl">Connexion au match de {n.home}…</p>
              )}
            </Overlay>
          )}
          {paused && (
            <Overlay>
              <span className="font-display text-5xl">Pause</span>
              <Button onClick={() => setPaused(false)} className="bg-gold text-primary-foreground"><Play className="h-4 w-4" /> Reprendre</Button>
            </Overlay>
          )}
          {peerLost && (
            <Overlay>
              <p className="font-display text-2xl">{role === "host" ? n.away : n.home} a perdu la connexion…</p>
              {canClaim ? (
                <Button disabled={claim.isPending} onClick={() => claim.mutate()} className="bg-gold text-primary-foreground">Réclamer la victoire</Button>
              ) : <p className="text-sm text-muted-foreground">On l'attend quelques secondes.</p>}
            </Overlay>
          )}
          {g.phase === "ended" && (
            <Overlay>
              <span className="font-display text-5xl text-gold">Fin du match</span>
              <span className="font-display text-4xl tabular-nums">{g.score.home} - {g.score.away}</span>
              {reportState === "sending" && <p className="text-sm text-muted-foreground">Envoi du résultat…</p>}
              {reportState === "sent" && m.mode === "live" && <p className="text-sm text-muted-foreground">En attente du résultat de ton adversaire…</p>}
              {reportState === "error" && <Button onClick={() => void report()} className="bg-gold text-primary-foreground">Renvoyer le résultat</Button>}
            </Overlay>
          )}
          {quitting && (
            <Overlay>
              <p className="font-display text-3xl">Quitter le match ?</p>
              <p className="max-w-xs text-center text-sm text-muted-foreground">Le match comptera comme perdu 3-0, sans pièces.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setQuitting(false)}>Continuer</Button>
                <Button variant="destructive" disabled={leave.isPending} onClick={() => leave.mutate()}>Quitter</Button>
              </div>
            </Overlay>
          )}
          {help && (
            <div className="absolute inset-0 z-30 overflow-auto rounded-xl bg-background/95 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-2xl">Commandes</p>
                <Button size="sm" variant="secondary" onClick={() => setHelp(false)}>Fermer</Button>
              </div>
              <ControlsHelp />
            </div>
          )}
        </div>
      </div>

      {touch ? <TouchPad pad={pad} /> : (
        <p className="hidden px-3 pb-2 text-center text-xs text-muted-foreground sm:block">
          ZQSD / flèches : bouger · J passe · I profondeur · L centre · K ou Espace tir (maintenir) · Maj sprint · E changer{pad.gamepad ? " · Manette connectée" : " · Branche une manette pour jouer avec"}
        </p>
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/60 p-4">{children}</div>;
}

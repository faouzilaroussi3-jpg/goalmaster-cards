import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Flag, Swords, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cardPower, ROUND_TIMEOUT_HOURS, THEMES, type Theme } from "@/lib/duel";
import { formatTimeLeft } from "@/lib/transfer-market";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { AcceptDuelDialog } from "@/components/duel/AcceptDuelDialog";
import { NewDuelDialog } from "@/components/duel/NewDuelDialog";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/duels/$duelId")({
  head: () => ({
    meta: [
      { title: "Duel en cours — Goalmaster" },
      { name: "description", content: "Choisis la bonne carte pour chaque manche et remporte le duel tactique." },
      { property: "og:title", content: "Duel tactique — Goalmaster" },
      { property: "og:description", content: "5 cartes, 5 manches à thème : qui fera le meilleur choix ?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DuelPage,
});

interface DeckCard {
  slot: number; user_card_id: string; card_id: string; name: string; club: string; nationality: string;
  pos: string; rating: number; rarity: string; version: string; image_url: string | null; used: boolean;
}
type Side = "challenger" | "opponent";
interface PlayerSide { id: string | null; name: string | null; score: number; played: boolean; reward: number | null; elo_delta: number | null }
interface RoundResult { round: number; theme: Theme; challenger: DeckCard & { power: number }; opponent: DeckCard & { power: number }; winner: Side | null }
interface DuelView {
  id: string; status: string; themes: Theme[]; round: number; side: Side | null;
  challenger: PlayerSide; opponent: PlayerSide; my_deck: DeckCard[]; their_deck: DeckCard[];
  rounds: RoundResult[]; my_move: number | null; winner_id: string | null; forfeit: boolean;
  round_started_at: string | null;
}

const asCard = (c: DeckCard) => ({ ...c, id: c.card_id, alt_image_url: c.version === "alt" ? c.image_url : null });

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function DuelPage() {
  const { duelId } = Route.useParams();
  const qc = useQueryClient();
  const { data: d, error, isLoading } = useQuery({
    queryKey: ["duel", duelId],
    refetchInterval: (q) => (q.state.data?.status === "active" || q.state.data?.status === "pending" ? 10_000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_duel", { _duel_id: duelId });
      if (error) throw error;
      return data as unknown as DuelView;
    },
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RoundResult | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rematch, setRematch] = useState(false);
  const seen = useRef<number | null>(null);
  const now = useNow();

  // Show the reveal when a new round result arrives (not for rounds already played before opening the page).
  useEffect(() => {
    if (!d) return;
    if (seen.current !== null && d.rounds.length > seen.current) setReveal(d.rounds[d.rounds.length - 1] ?? null);
    seen.current = d.rounds.length;
  }, [d]);
  useEffect(() => { setSelected(null); }, [d?.round]);
  // Victory / defeat jingle when the duel ends while the page is open.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!d) return;
    if (lastStatus.current === "active" && d.status === "finished") {
      const me = d[d.side ?? "opponent"];
      const delay = d.rounds.length ? 2600 : 0;
      setTimeout(() => (d.winner_id === null ? sfx.roundDraw() : d.winner_id === me.id ? sfx.duelWin() : sfx.duelLose()), delay);
    }
    lastStatus.current = d.status;
  }, [d]);

  const play = useMutation({
    mutationFn: async (slot: number) => {
      const { data, error } = await supabase.rpc("play_card", { _duel_id: duelId, _slot: slot });
      if (error) throw error;
      return data as unknown as DuelView;
    },
    onSuccess: (view) => { sfx.playCard(); qc.setQueryData(["duel", duelId], view); qc.invalidateQueries({ queryKey: ["duels"] }); },
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["duel", duelId] }); },
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_duel", { _duel_id: duelId });
      if (error) throw error;
    },
    onSuccess: () => { setConfirmLeave(false); qc.invalidateQueries({ queryKey: ["duel", duelId] }); qc.invalidateQueries({ queryKey: ["duels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-10 text-center text-muted-foreground">Chargement du duel…</p>;
  if (error || !d) return (
    <div className="mx-auto max-w-xl p-10 text-center">
      <p className="text-muted-foreground">Ce duel est introuvable.</p>
      <Button asChild className="mt-4" variant="secondary"><Link to="/duels">Retour aux duels</Link></Button>
    </div>
  );

  const mySide: Side = d.side ?? "opponent";
  const theirSide: Side = mySide === "challenger" ? "opponent" : "challenger";
  const me = d[mySide];
  const them = d[theirSide];
  const theme = d.themes[d.round] as Theme | undefined;
  const active = d.status === "active";
  const iPlayed = d.my_move !== null && d.my_move !== undefined;
  const deadline = active && d.round_started_at ? new Date(d.round_started_at).getTime() + ROUND_TIMEOUT_HOURS * 3600_000 : null;
  const result = d.status === "finished" ? (d.winner_id === null ? "draw" : d.winner_id === me.id ? "win" : "loss") : null;
  const myCard = selected !== null ? d.my_deck[selected] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/duels" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Duels</Link>

      {/* Scoreboard */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Toi</p>
          <p className="truncate font-display text-2xl">{me.name ?? "Toi"}</p>
        </div>
        <div className="text-center">
          <p className="font-display text-5xl tabular-nums text-gold">{me.score} - {them.score}</p>
          <p className="text-xs text-muted-foreground">
            {d.status === "pending" ? "En attente" : d.status === "finished" ? "Terminé" : d.status === "active" ? `Manche ${d.round + 1} / 5` : "Annulé"}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Adversaire</p>
          <p className="truncate font-display text-2xl">{them.name ?? "Défi ouvert"}</p>
        </div>
      </div>

      {/* Round themes */}
      <ol className="mt-4 grid grid-cols-5 gap-2">
        {d.themes.map((t, i) => {
          const r = d.rounds[i];
          const won = r && r.winner === mySide;
          const lost = r && r.winner === theirSide;
          return (
            <li key={i} title={THEMES[t].hint} className={cn(
              "rounded-lg border px-2 py-2 text-center transition",
              active && i === d.round ? "border-primary bg-primary/15 shadow-gold" : "border-border bg-card",
              won && "border-primary/60 bg-primary/25", lost && "opacity-60",
            )}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manche {i + 1}</p>
              <p className="truncate font-display text-lg leading-tight">{THEMES[t].label}</p>
              <p className="text-[10px] font-semibold">{r ? (won ? "Gagnée" : lost ? "Perdue" : "Égalité") : active && i === d.round ? "En cours" : "\u00a0"}</p>
            </li>
          );
        })}
      </ol>
      {active && theme && <p className="mt-2 text-center text-sm text-muted-foreground"><Zap className="inline h-4 w-4 text-primary" /> {THEMES[theme].label} : {THEMES[theme].hint}</p>}

      {/* Finished banner */}
      {result && (
        <div className={cn("mt-5 rounded-2xl border p-5 text-center", result === "win" ? "border-primary bg-primary/15 shadow-gold" : "border-border bg-card")}>
          <p className="font-display text-5xl text-gold">{result === "win" ? "Victoire !" : result === "loss" ? "Défaite" : "Match nul"}</p>
          {d.forfeit && <p className="text-sm text-muted-foreground">Par abandon</p>}
          <p className="mt-2 text-sm">
            <b className="text-primary">+{me.reward ?? 0} pièces</b>
            <span className="mx-2 text-muted-foreground">·</span>
            <b className={(me.elo_delta ?? 0) >= 0 ? "text-r-uncommon" : "text-destructive"}>{(me.elo_delta ?? 0) >= 0 ? "+" : ""}{me.elo_delta ?? 0} points de duel</b>
          </p>
          {(me.reward ?? 0) === 0 && !d.forfeit && <p className="mt-1 text-xs text-muted-foreground">Limite de 5 duels récompensés par jour atteinte.</p>}
          {them.id && d.side && (
            <Button className="mt-3 bg-gold text-primary-foreground" onClick={() => setRematch(true)}><Swords className="h-4 w-4" /> Revanche</Button>
          )}
        </div>
      )}

      {/* Pending */}
      {d.status === "pending" && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-5 text-center">
          {d.side === "challenger" ? (
            <>
              <p className="font-display text-2xl">{them.id ? `En attente de ${them.name}…` : "Défi ouvert : en attente d'un adversaire…"}</p>
              <p className="text-sm text-muted-foreground">Tu recevras une notification dans le menu Duels dès que le duel commence.</p>
              <Button variant="ghost" className="mt-2" disabled={leave.isPending} onClick={() => leave.mutate()}>Annuler le défi</Button>
            </>
          ) : (
            <>
              <p className="font-display text-2xl">{d.challenger.name} te défie !</p>
              <Button className="mt-3 bg-gold text-primary-foreground" onClick={() => setAccepting(true)}>Relever le défi</Button>
            </>
          )}
        </div>
      )}

      {(d.status === "cancelled" || d.status === "declined") && (
        <p className="mt-5 rounded-2xl border border-border bg-card p-5 text-center text-muted-foreground">
          {d.status === "declined" ? "Ce défi a été refusé." : "Ce défi a été annulé ou a expiré."}
        </p>
      )}

      {/* Opponent team */}
      {d.their_deck.length > 0 && (
        <TeamRow title={`Équipe de ${them.name ?? "l'adversaire"}`} cards={d.their_deck} theme={active ? theme : undefined} />
      )}

      {/* My team */}
      {d.my_deck.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-wide">Ton équipe</h2>
            {deadline && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {formatTimeLeft(deadline - now)} pour jouer</span>}
          </div>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {d.my_deck.map((c) => {
              const chosen = d.my_move === c.slot;
              const canPick = active && !iPlayed && !c.used;
              return (
                <button
                  key={c.slot}
                  type="button"
                  disabled={!canPick}
                  data-sfx="none"
                  onClick={() => { sfx.select(); setSelected(c.slot === selected ? null : c.slot); }}
                  aria-pressed={selected === c.slot}
                  aria-label={`Choisir ${c.name}`}
                  className={cn("relative rounded-lg text-left transition",
                    canPick && "hover:-translate-y-1",
                    (selected === c.slot || chosen) && "-translate-y-2 ring-2 ring-primary ring-offset-2 ring-offset-background",
                    c.used && "opacity-30 grayscale")}
                >
                  <PlayerCard card={asCard(c)} />
                  <PowerTag card={c} theme={active ? theme : undefined} used={c.used} />
                </button>
              );
            })}
          </div>

          {active && d.side && (
            <div className="sticky bottom-3 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
              {iPlayed ? (
                <p className="text-sm">
                  Tu as joué <b>{d.my_deck[d.my_move!]?.name}</b>.{" "}
                  <span className="text-muted-foreground">{them.played ? "Révélation…" : `En attente du choix de ${them.name}…`}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {myCard && theme ? <>Puissance de <b className="text-foreground">{myCard.name}</b> : <b className="text-primary">{cardPower(myCard, theme)}</b></> : "Choisis la carte à jouer pour cette manche."}
                  {them.played && <span className="ml-2 text-primary">{them.name} a déjà joué.</span>}
                </p>
              )}
              <div className="flex gap-2">
                {confirmLeave ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(false)}>Non</Button>
                    <Button size="sm" variant="destructive" disabled={leave.isPending} onClick={() => leave.mutate()}>Confirmer l'abandon</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(true)}><Flag className="h-4 w-4" /> Abandonner</Button>
                )}
                {!iPlayed && (
                  <Button data-sfx="none" disabled={selected === null || play.isPending} onClick={() => selected !== null && play.mutate(selected)} className="bg-gold font-display text-lg text-primary-foreground shadow-gold">
                    Jouer cette carte
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* History */}
      {d.rounds.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-2xl tracking-wide">Manches jouées</h2>
          <ol className="space-y-2">
            {[...d.rounds].reverse().map((r) => <RoundLine key={r.round} r={r} mySide={mySide} />)}
          </ol>
        </section>
      )}

      {reveal && <RevealOverlay r={reveal} mySide={mySide} onDone={() => setReveal(null)} />}
      {accepting && <AcceptDuelDialog duel={{ id: d.id, challenger: d.challenger.name ?? "?" }} onClose={() => { setAccepting(false); qc.invalidateQueries({ queryKey: ["duel", duelId] }); }} />}
      <NewDuelDialog open={rematch} onClose={() => setRematch(false)} preset={them.id ? { id: them.id, username: them.name ?? "?" } : null} />
    </div>
  );
}

function PowerTag({ card, theme, used }: { card: DeckCard; theme?: Theme | undefined; used: boolean }) {
  return (
    <span className="mt-1 flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{card.pos}</span>
      {used ? <span className="text-muted-foreground">Jouée</span> : theme ? (
        <span className="flex items-center gap-0.5 font-bold text-primary"><Zap className="h-3 w-3" />{cardPower(card, theme)}</span>
      ) : null}
    </span>
  );
}

function TeamRow({ title, cards, theme }: { title: string; cards: DeckCard[]; theme?: Theme | undefined }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-2xl tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {cards.map((c) => (
          <div key={c.slot} className={cn(c.used && "opacity-30 grayscale")}>
            <PlayerCard card={asCard(c)} />
            <PowerTag card={c} theme={theme} used={c.used} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RoundLine({ r, mySide }: { r: RoundResult; mySide: Side }) {
  const mine = r[mySide];
  const theirs = r[mySide === "challenger" ? "opponent" : "challenger"];
  const outcome = r.winner === null ? "Égalité" : r.winner === mySide ? "Gagnée" : "Perdue";
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2", r.winner === mySide ? "border-primary/60" : "border-border")}>
      <span className="w-24 shrink-0">
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Manche {r.round}</span>
        <span className="font-display text-lg">{THEMES[r.theme].label}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-sm"><b>{mine.name}</b> <span className="text-primary">{mine.power}</span></span>
      <span className="font-display text-sm text-muted-foreground">vs</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm"><span className="text-primary">{theirs.power}</span> <b>{theirs.name}</b></span>
      <span className={cn("w-16 shrink-0 text-right text-xs font-bold", r.winner === mySide ? "text-primary" : "text-muted-foreground")}>{outcome}</span>
    </li>
  );
}

function RevealOverlay({ r, mySide, onDone }: { r: RoundResult; mySide: Side; onDone: () => void }) {
  const mine = r[mySide];
  const theirs = r[mySide === "challenger" ? "opponent" : "challenger"];
  const won = r.winner === mySide;
  const lost = r.winner !== null && !won;
  useEffect(() => { const t = setTimeout(onDone, 3800); return () => clearTimeout(t); }, [onDone]);
  useEffect(() => {
    sfx.cardFlip();
    const t = setTimeout(() => (won ? sfx.roundWin() : lost ? sfx.roundLose() : sfx.roundDraw()), 600);
    return () => clearTimeout(t);
  }, [won, lost]);
  return (
    <button type="button" onClick={onDone} aria-label="Fermer la révélation" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/90 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Manche {r.round} · {THEMES[r.theme].label}</p>
      <div className="flex items-center gap-4 sm:gap-8">
        <div className={cn("w-32 sm:w-44 animate-in slide-in-from-left-24 fade-in duration-500", lost && "opacity-50 grayscale")}>
          <PlayerCard card={asCard(mine)} />
          <p className="mt-2 text-center font-display text-3xl text-primary">{mine.power}</p>
        </div>
        <span className="font-display text-4xl text-muted-foreground animate-in zoom-in-50 duration-700">VS</span>
        <div className={cn("w-32 sm:w-44 animate-in slide-in-from-right-24 fade-in duration-500", won && "opacity-50 grayscale")}>
          <PlayerCard card={asCard(theirs)} />
          <p className="mt-2 text-center font-display text-3xl text-primary">{theirs.power}</p>
        </div>
      </div>
      <p className="font-display text-5xl text-gold animate-in zoom-in-75 fade-in delay-500 duration-500 fill-mode-both">
        {won ? "Manche gagnée !" : lost ? "Manche perdue" : "Égalité"}
      </p>
    </button>
  );
}

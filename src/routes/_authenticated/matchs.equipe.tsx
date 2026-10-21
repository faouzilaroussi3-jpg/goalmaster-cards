import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eraser, Save, Wand2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useAuth } from "@/lib/auth";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";
import {
  autoPick, BENCH_SIZE, canPlayMatch, firstName, FORMATION_KEYS, FORMATIONS, POSITION_LABEL, positionFit, rarityBonus,
  rateSlots, rateTeam, TACTICS, teamProblem, XI_SIZE, type FormationKey, type MatchCard, type Tactic,
} from "@/lib/manager";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChemDots, fitTone, rarityColor, TeamStats } from "@/components/match/TeamSheet";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/matchs/equipe")({
  head: () => ({
    meta: [
      { title: "Mon équipe de 11 — Goalmaster" },
      { name: "description", content: "Choisis ta formation, tes 11 titulaires et tes remplaçants pour avoir le meilleur général et le meilleur collectif." },
      { property: "og:title", content: "Mon équipe de 11 — Goalmaster" },
      { property: "og:description", content: "Le bureau du manager : formation, tactique, titulaires et banc." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamBuilderPage,
});

interface OwnedCopy {
  id: string;
  version: string;
  cards: { id: string; name: string; club: string; nationality: string; pos: string; rating: number; rarity: string; image_url: string | null; alt_image_url: string | null } | null;
}
type Sel = { kind: "xi" | "bench"; i: number };

function TeamBuilderPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const { data: copies = [], isLoading } = useQuery({
    queryKey: ["my-copies", uid],
    queryFn: async () => {
      const data = await fetchAll((from, to) => supabase.from("user_cards").select("id, version, cards(id, name, club, nationality, pos, rating, rarity, image_url, alt_image_url)").eq("user_id", uid).order("id").range(from, to));
      return data as unknown as OwnedCopy[];
    },
  });
  const { data: saved, isLoading: savedLoading } = useQuery({
    queryKey: ["manager-team", uid, "full"],
    queryFn: async () => (await supabase.from("manager_teams").select("*").eq("user_id", uid).maybeSingle()).data,
  });

  // One option per card + version; any copy can play since a match never moves the card.
  const { options, byCopy } = useMemo(() => {
    const m = new Map<string, MatchCard>();
    const byCopy = new Map<string, MatchCard>();
    for (const c of copies) {
      if (!c.cards) continue;
      const card: MatchCard = {
        user_card_id: c.id, card_id: c.cards.id, name: c.cards.name, club: c.cards.club, nationality: c.cards.nationality,
        pos: c.cards.pos.toUpperCase(), rating: c.cards.rating, rarity: c.cards.rarity, version: c.version,
        image_url: c.version === "alt" ? (c.cards.alt_image_url ?? c.cards.image_url) : c.cards.image_url,
      };
      if (!canPlayMatch(card)) continue;
      byCopy.set(c.id, card);
      const k = `${card.card_id}:${card.version}`;
      if (!m.has(k)) m.set(k, card);
    }
    return { options: [...m.values()], byCopy };
  }, [copies]);

  const [formation, setFormation] = useState<FormationKey>("4-3-3");
  const [tactic, setTactic] = useState<Tactic>("equilibre");
  const [xi, setXi] = useState<(MatchCard | null)[]>(() => Array(XI_SIZE).fill(null));
  const [bench, setBench] = useState<(MatchCard | null)[]>(() => Array(BENCH_SIZE).fill(null));
  const [sel, setSel] = useState<Sel | null>({ kind: "xi", i: 0 });
  const [q, setQ] = useState("");
  const [allPositions, setAllPositions] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || isLoading || savedLoading) return;
    loaded.current = true;
    if (!saved) return;
    setFormation(saved.formation as FormationKey);
    setTactic(saved.tactic as Tactic);
    setXi(Array.from({ length: XI_SIZE }, (_, i) => byCopy.get(saved.starters[i] ?? "") ?? null));
    setBench(Array.from({ length: BENCH_SIZE }, (_, i) => byCopy.get(saved.bench[i] ?? "") ?? null));
    setSel(null);
  }, [saved, isLoading, savedLoading, byCopy]);

  const slots = FORMATIONS[formation].slots;
  const rated = rateSlots(formation, xi);
  const full = xi.every(Boolean);
  const team = full ? rateTeam(formation, tactic, xi as MatchCard[]) : null;
  const problem = teamProblem(xi, bench);
  const savedLost = !!saved && (saved.starters.some((id) => !byCopy.has(id)) || saved.bench.some((id) => !byCopy.has(id)));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_manager_team", {
        _formation: formation, _tactic: tactic,
        _starters: xi.map((c) => c!.user_card_id), _bench: bench.filter(Boolean).map((c) => c!.user_card_id),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      sfx.success();
      toast.success("Équipe enregistrée !", { description: "Elle jouera tes prochains matchs." });
      qc.invalidateQueries({ queryKey: ["manager-team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const where = (cardId: string): Sel | null => {
    const a = xi.findIndex((c) => c?.card_id === cardId);
    if (a >= 0) return { kind: "xi", i: a };
    const b = bench.findIndex((c) => c?.card_id === cardId);
    return b >= 0 ? { kind: "bench", i: b } : null;
  };
  const get = (s: Sel) => (s.kind === "xi" ? xi[s.i] : bench[s.i]) ?? null;

  function place(card: MatchCard) {
    if (!sel) return;
    sfx.playCard();
    const nx = [...xi], nb = [...bench];
    const set = (s: Sel, v: MatchCard | null) => { if (s.kind === "xi") nx[s.i] = v; else nb[s.i] = v; };
    const from = where(card.card_id);
    const current = get(sel);
    if (from) set(from, current); // already in the team: swap places
    set(sel, card);
    setXi(nx); setBench(nb);
    const nextEmpty = nx.findIndex((c) => !c);
    setSel(nextEmpty >= 0 ? { kind: "xi", i: nextEmpty } : null);
  }
  function remove(s: Sel) {
    sfx.cardSlide();
    if (s.kind === "xi") setXi((p) => p.map((c, i) => (i === s.i ? null : c)));
    else setBench((p) => p.map((c, i) => (i === s.i ? null : c)));
  }
  function auto() {
    const r = autoPick(formation, options);
    setXi(r.xi); setBench(Array.from({ length: BENCH_SIZE }, (_, i) => r.bench[i] ?? null));
    setSel(null);
    sfx.sparkle();
  }

  const role = sel?.kind === "xi" ? slots[sel.i]!.role : null;
  const candidates = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return options
      .filter((o) => !ql || `${o.name} ${o.club} ${o.nationality} ${o.pos}`.toLowerCase().includes(ql))
      .filter((o) => !role || allPositions || ql || positionFit(o.pos, role) >= -3)
      .map((o) => ({ o, score: o.rating + rarityBonus(o.rarity, o.version) + (role ? positionFit(o.pos, role) : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);
  }, [options, q, role, allPositions]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/matchs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Matchs</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl text-gold">Mon équipe</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Touche un poste puis choisis un joueur. Les joueurs à leur poste, du même club ou du même pays rendent l'équipe plus forte.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={auto} disabled={!options.length}><Wand2 className="h-4 w-4" /> Remplir automatiquement</Button>
          <Button variant="ghost" onClick={() => { setXi(Array(XI_SIZE).fill(null)); setBench(Array(BENCH_SIZE).fill(null)); setSel({ kind: "xi", i: 0 }); }}><Eraser className="h-4 w-4" /> Vider</Button>
        </div>
      </div>

      {savedLost && <p className="mt-4 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm">Une carte de ton équipe enregistrée n'est plus dans ta collection : remplace-la puis enregistre.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FORMATION_KEYS.map((f) => (
              <button key={f} type="button" data-sfx="tab" onClick={() => setFormation(f)}
                className={cn("rounded-full px-3 py-1 text-sm font-bold", f === formation ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {FORMATIONS[f].label}
              </button>
            ))}
          </div>
          <div className="mm-builder-pitch relative mx-auto aspect-[68/105] w-full max-w-lg overflow-hidden rounded-xl">
            {slots.map((sl, i) => {
              const p = rated[i];
              const on = sel?.kind === "xi" && sel.i === i;
              return (
                <button key={i} type="button" data-sfx="none" onClick={() => { sfx.select(); setSel({ kind: "xi", i }); }}
                  className={cn("absolute z-10 flex w-[17%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg transition", on && "z-20 scale-105")}
                  style={{ left: `${sl.y}%`, top: `${87 - (sl.x - 5) * 1.74}%` }}
                  aria-label={`${POSITION_LABEL[sl.role]}${p ? ` : ${p.name}` : " : vide"}`}>
                  <PitchCard card={p} role={sl.role} on={on} />
                  {p && (
                    <span className="flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-px leading-none">
                      <span className={cn("text-[9px] font-bold", fitTone(p.fit))}>{sl.role}</span>
                      <span className="font-display text-xs text-primary">{p.eff}</span>
                      <ChemDots chem={p.chem} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remplaçants ({bench.filter(Boolean).length}/{BENCH_SIZE})</h3>
          <div className="grid grid-cols-5 gap-2">
            {bench.map((c, i) => {
              const on = sel?.kind === "bench" && sel.i === i;
              return (
                <button key={i} type="button" data-sfx="none" onClick={() => { sfx.select(); setSel({ kind: "bench", i }); }}
                  className={cn("rounded-lg transition", on && "scale-105")} aria-label={`Remplaçant ${i + 1}${c ? ` : ${c.name}` : " : vide"}`}>
                  <PitchCard card={c} role="+" on={on} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="panel p-4">
            {team ? <TeamStats team={team} /> : (
              <p className="text-sm text-muted-foreground">Place tes 11 titulaires pour voir le général, le collectif et la force de ton équipe ({xi.filter(Boolean).length}/{XI_SIZE}).</p>
            )}
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tactique de départ</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TACTICS) as Tactic[]).map((t) => (
                  <button key={t} type="button" data-sfx="tab" onClick={() => setTactic(t)} title={TACTICS[t].hint}
                    className={cn("rounded-full px-3 py-1 text-sm font-semibold", t === tactic ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                    {TACTICS[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{problem ?? "Équipe prête !"}</p>
              <Button disabled={!!problem || save.isPending} onClick={() => save.mutate()} className="bg-gold font-display text-lg text-primary-foreground shadow-gold">
                <Save className="h-4 w-4" /> Enregistrer l'équipe
              </Button>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl tracking-wide">
                {sel ? (sel.kind === "xi" ? `Poste : ${POSITION_LABEL[role!]}` : `Remplaçant n°${sel.i + 1}`) : "Choisis un poste"}
              </h2>
              {sel && get(sel) && (
                <Button size="sm" variant="ghost" onClick={() => remove(sel)}><X className="h-4 w-4" /> Retirer {firstName(get(sel)!.name)}</Button>
              )}
            </div>
            {sel ? (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Input className="min-w-40 flex-1" placeholder="Chercher un joueur, un club, un pays…" value={q} onChange={(e) => setQ(e.target.value)} />
                  {role && (
                    <button type="button" onClick={() => setAllPositions((v) => !v)} className={cn("rounded-md px-3 text-sm font-semibold", allPositions ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                      {allPositions ? "Tous les postes" : "Postes adaptés"}
                    </button>
                  )}
                </div>
                {isLoading ? <p className="text-sm text-muted-foreground">Chargement de ta collection…</p> : !candidates.length ? (
                  <p className="text-sm text-muted-foreground">Aucun joueur trouvé. Ouvre des packs pour agrandir ton effectif !</p>
                ) : (
                  <ul className="max-h-[50dvh] space-y-1 overflow-y-auto pr-1">
                    {candidates.map(({ o, score }) => {
                      const inTeam = where(o.card_id);
                      const fit = role ? positionFit(o.pos, role) : 0;
                      return (
                        <li key={`${o.card_id}:${o.version}`}>
                          <button type="button" data-sfx="none" onClick={() => place(o)}
                            className="flex w-full items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-left text-sm transition hover:bg-secondary">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rarityColor(o.rarity) }} title={rarityMeta(o.rarity).label} />
                            <span className="min-w-0 flex-1 truncate">
                              <b>{o.name}</b> <span className="text-xs text-muted-foreground">{o.club} · {o.nationality}</span>
                              {o.version !== "normal" && <span className="ml-1 rounded bg-primary/20 px-1 text-[10px] font-bold text-primary">{VERSION_LABEL[o.version]}</span>}
                              {inTeam && <span className="ml-1 rounded bg-foreground/10 px-1 text-[10px]">Dans l'équipe</span>}
                            </span>
                            <span className={cn("w-10 text-center text-xs font-bold", fitTone(fit))}>{o.pos}</span>
                            <span className="w-8 text-right font-display text-lg leading-none text-primary" title="Note à ce poste (sans le collectif)">{score}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : <p className="text-sm text-muted-foreground">Touche un poste sur le terrain ou une place sur le banc.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A player's real card on the pitch (or an empty card-shaped slot showing the position to fill). */
function PitchCard({ card, role, on }: { card: MatchCard | null; role: string; on: boolean }) {
  return (
    <span className={cn("pointer-events-none block w-full rounded-lg", on && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
      {card ? (
        <PlayerCard card={{ ...card, id: card.card_id, alt_image_url: card.version === "alt" ? card.image_url : null }} />
      ) : (
        <span className="flex aspect-[5/7] w-full items-center justify-center rounded-lg border-2 border-dashed border-foreground/40 bg-background/40 font-display text-base text-muted-foreground">
          {role}
        </span>
      )}
    </span>
  );
}

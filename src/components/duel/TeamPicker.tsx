import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useAuth } from "@/lib/auth";
import { rarityMeta, useRarities } from "@/lib/rarity";
import { cardPower, DECK_BUDGET, DECK_SIZE, deckCost, deckProblem, duelCost, THEMES, type Theme } from "@/lib/duel";
import { PlayerCard } from "@/components/PlayerCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

interface OwnedCopy {
  id: string;
  version: string;
  cards: { id: string; name: string; club: string; nationality: string; pos: string; rating: number; rarity: string; image_url: string | null; alt_image_url: string | null } | null;
}

export interface PickedCard {
  user_card_id: string;
  card_id: string;
  name: string; club: string; nationality: string; pos: string; rating: number; rarity: string;
  version: string; image_url: string | null; alt_image_url: string | null;
}

/** Pick 5 different players from the collection within the duel budget. */
export function TeamPicker({ themes, submitLabel, busy, onSubmit }: {
  themes?: Theme[] | null | undefined;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (cards: PickedCard[]) => void;
}) {
  const rarities = useRarities();
  const { session } = useAuth();
  const uid = session!.user.id;
  const { data: copies = [], isLoading } = useQuery({
    queryKey: ["my-copies", uid],
    queryFn: async () => {
      const data = await fetchAll((from, to) => supabase.from("user_cards").select("id, version, cards(id, name, club, nationality, pos, rating, rarity, image_url, alt_image_url)").eq("user_id", uid).order("id").range(from, to));
      return data as unknown as OwnedCopy[];
    },
  });

  // One entry per card + version (any copy can play: the duel never moves the card).
  const options = useMemo(() => {
    const m = new Map<string, PickedCard>();
    for (const c of copies) {
      if (!c.cards || c.cards.rarity === "secret_ultimate") continue;
      const k = `${c.cards.id}:${c.version}`;
      if (!m.has(k)) m.set(k, { ...c.cards, card_id: c.cards.id, user_card_id: c.id, version: c.version });
    }
    return [...m.values()].sort((a, b) => rarityMeta(b.rarity).rank - rarityMeta(a.rarity).rank || b.rating - a.rating);
  }, [copies]);

  const [picked, setPicked] = useState<PickedCard[]>([]);
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<string>("all");
  const cost = deckCost(picked);
  const problem = deckProblem(picked);
  const left = DECK_BUDGET - cost;

  const shown = options.filter((o) =>
    (rarity === "all" || o.rarity === rarity) &&
    (!q || `${o.name} ${o.club} ${o.nationality} ${o.pos}`.toLowerCase().includes(q.toLowerCase())));

  function toggle(o: PickedCard) {
    if (picked.some((x) => x.user_card_id === o.user_card_id)) sfx.cardSlide(); else sfx.playCard();
    setPicked((p) => p.some((x) => x.user_card_id === o.user_card_id) ? p.filter((x) => x.user_card_id !== o.user_card_id) : [...p, o]);
  }

  return (
    <div className="flex flex-col gap-4">
      {themes && themes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Manches :</span>
          {themes.map((t, i) => (
            <span key={i} className="rounded-full bg-secondary px-2.5 py-1 font-semibold" title={THEMES[t].hint}>{i + 1}. {THEMES[t].label}</span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Ton équipe <span className="text-muted-foreground">({picked.length}/{DECK_SIZE})</span></span>
          <span className={cn("font-bold tabular-nums", cost > DECK_BUDGET ? "text-destructive" : "text-primary")}>Budget {cost} / {DECK_BUDGET}</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full transition-all", cost > DECK_BUDGET ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, (cost / DECK_BUDGET) * 100)}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: DECK_SIZE }, (_, i) => picked[i]).map((c, i) => c ? (
            <button key={c.user_card_id} type="button" data-sfx="none" onClick={() => toggle(c)} className="group relative" aria-label={`Retirer ${c.name}`}>
              <PlayerCard card={c} />
              <span className="absolute -right-1 -top-1 z-10 rounded-full bg-background p-0.5 text-muted-foreground group-hover:text-foreground"><X className="h-3.5 w-3.5" /></span>
            </button>
          ) : (
            <div key={`empty-${i}`} className="flex aspect-[5/7] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">{i + 1}</div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="min-w-40 flex-1" placeholder="Chercher un joueur, un club, un poste…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Rareté">
          <option value="all">Toutes raretés</option>
          {rarities.filter((r) => r.key !== "secret_ultimate").map((r) => (
            <option key={r.key} value={r.key}>{r.label} · {duelCost(r.key)} pt{duelCost(r.key) > 1 ? "s" : ""}</option>
          ))}
        </select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement de ta collection…</p> : !options.length ? (
        <p className="text-sm text-muted-foreground">Tu n'as pas encore de carte. Ouvre des packs !</p>
      ) : (
        <div className="grid max-h-[42dvh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-5">
          {shown.map((o) => {
            const on = picked.some((x) => x.user_card_id === o.user_card_id);
            const samePlayer = !on && picked.some((x) => x.card_id === o.card_id);
            const tooExpensive = !on && duelCost(o.rarity) > left;
            const full = !on && picked.length >= DECK_SIZE;
            const off = samePlayer || tooExpensive || full;
            const best = themes?.length ? Math.max(...themes.map((t) => cardPower(o, t))) : null;
            return (
              <button
                key={o.user_card_id}
                type="button"
                disabled={off}
                data-sfx="none"
                onClick={() => toggle(o)}
                className={cn("relative rounded-lg text-left transition", on && "ring-2 ring-primary ring-offset-2 ring-offset-background", off && "opacity-35")}
                aria-pressed={on}
                aria-label={`${on ? "Retirer" : "Ajouter"} ${o.name}`}
              >
                <PlayerCard card={o} />
                <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{o.pos}</span>
                  <span className="font-bold text-primary">{duelCost(o.rarity)} pt{duelCost(o.rarity) > 1 ? "s" : ""}</span>
                </span>
                {best !== null && <span className="block text-[10px] text-muted-foreground">Puissance max {best}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{problem ?? "Équipe prête !"}</p>
        <Button
          disabled={!!problem || busy}
          onClick={() => onSubmit(picked)}
          className="bg-gold font-display text-lg text-primary-foreground shadow-gold"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

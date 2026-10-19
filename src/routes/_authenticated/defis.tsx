import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Coins, Gift, Lock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyChallenges } from "@/lib/auth";
import { challengeState, claimableSummary, goalText, groupChallenges, progressRatio, type Challenge } from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/defis")({
  head: () => ({
    meta: [
      { title: "Défis — Goalmaster" },
      { name: "description", content: "Accomplis des défis en ouvrant des packs et gagne des pièces selon les cartes obtenues dans chaque rareté." },
      { property: "og:title", content: "Défis — Goalmaster" },
      { property: "og:description", content: "Des pièces à gagner pour chaque palier de cartes Communes, Rares, Légendaires et plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChallengesPage,
});

// Category accent = the rarity token of the cards it counts.
const ACCENT: Record<string, string> = {
  total: "var(--primary)",
  common: "var(--r-common)",
  uncommon: "var(--r-uncommon)",
  rare: "var(--r-rare)",
  super_rare: "var(--r-sr)",
  legendary: "var(--r-legendary)",
  alt: "var(--r-legendary)",
  secret_legendary: "var(--r-sl)",
  shiny: "var(--r-sl)",
  secret_ultimate: "var(--r-su)",
};

function ChallengesPage() {
  const { data: list = [], isLoading } = useMyChallenges();
  const qc = useQueryClient();
  const summary = claimableSummary(list);
  const groups = groupChallenges(list);
  const done = list.filter((c) => c.claimed).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["challenges"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const claimOne = useMutation({
    mutationFn: async (c: Challenge) => {
      const { data, error } = await supabase.rpc("claim_challenge", { _challenge_id: c.challenge_id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (coins, c) => { toast.success(`Défi « ${c.title} » : +${coins} pièces`); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const claimAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_all_challenges");
      if (error) throw error;
      return data as { claimed: number; coins: number };
    },
    onSuccess: (r) => { toast.success(`${r.claimed} défi${r.claimed > 1 ? "s" : ""} récupéré${r.claimed > 1 ? "s" : ""} : +${r.coins} pièces`); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl text-gold">Défis</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chaque carte que tu tires dans un pack fait avancer tes défis, doublons compris. Atteins un palier pour gagner des pièces.
          </p>
          {list.length > 0 && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {done} / {list.length} défis terminés
            </p>
          )}
        </div>
        <Button
          disabled={summary.count === 0 || claimAll.isPending}
          onClick={() => claimAll.mutate()}
          className="h-auto bg-gold px-5 py-2.5 font-display text-lg text-primary-foreground shadow-gold disabled:opacity-40"
        >
          <Gift className="h-4 w-4" />
          {summary.count > 0 ? <>Tout récupérer · +{summary.coins}</> : "Rien à récupérer"}
        </Button>
      </div>

      {isLoading && <p className="mt-10 text-center text-muted-foreground">Chargement des défis…</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section
            key={g.key}
            className="rounded-xl border border-border bg-card p-4"
            style={{ ["--accent" as string]: ACCENT[g.key] ?? "var(--primary)" }}
          >
            <header className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-[color:var(--accent)]" />
              <h2 className="font-display text-2xl tracking-wide text-[color:var(--accent)]">{g.label}</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {g.items[0]?.progress ?? 0} carte{(g.items[0]?.progress ?? 0) > 1 ? "s" : ""} obtenue{(g.items[0]?.progress ?? 0) > 1 ? "s" : ""}
              </span>
            </header>
            <ul className="space-y-2">
              {g.items.map((c) => (
                <ChallengeRow key={c.challenge_id} c={c} busy={claimOne.isPending || claimAll.isPending} onClaim={() => claimOne.mutate(c)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ChallengeRow({ c, busy, onClaim }: { c: Challenge; busy: boolean; onClaim: () => void }) {
  const state = challengeState(c);
  const pct = Math.round(progressRatio(c) * 100);
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background/60 p-3 transition",
        state === "claimable" ? "border-[color:var(--accent)] shadow-[0_0_18px_-6px_var(--accent)]" : "border-border",
        state === "claimed" && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold">{c.title}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {Math.min(c.progress, c.target)} / {c.target}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{goalText(c)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[color:var(--accent)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex w-28 shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1 text-sm font-bold text-primary">
          <Coins className="h-4 w-4" /> {c.reward_coins}
        </span>
        {state === "claimed" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Récupéré</span>
        )}
        {state === "claimable" && (
          <Button size="sm" disabled={busy} onClick={onClaim} className="h-7 bg-gold px-3 text-xs font-bold text-primary-foreground">
            Récupérer
          </Button>
        )}
        {state === "in_progress" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> {pct} %</span>
        )}
      </div>
    </li>
  );
}

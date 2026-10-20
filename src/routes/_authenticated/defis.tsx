import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, Coins, Gift, Lock, Package, Sun, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyChallenges, useMyPeriodicChallenges } from "@/lib/auth";
import { challengeState, claimableSummary, goalText, groupChallenges, progressRatio, type Challenge } from "@/lib/challenges";
import { packText, periodicGoalText, periodicSummary, timeLeft, type PeriodicChallenge } from "@/lib/periodic-challenges";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/defis")({
  head: () => ({
    meta: [
      { title: "Défis — Goalmaster" },
      { name: "description", content: "Défis quotidiens, hebdomadaires et paliers de collection : gagne des packs et des pièces en ouvrant des packs et en jouant des duels." },
      { property: "og:title", content: "Défis — Goalmaster" },
      { property: "og:description", content: "Des packs et des pièces à gagner chaque jour, chaque semaine et à chaque palier de cartes." },
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

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function ChallengesPage() {
  const { data: list = [], isLoading } = useMyChallenges();
  const { data: periodic = [], isLoading: loadingPeriodic } = useMyPeriodicChallenges();
  const qc = useQueryClient();
  const now = useNow();
  const summary = claimableSummary(list);
  const pSummary = periodicSummary(periodic);
  const totalReady = summary.count + pSummary.count;
  const totalCoins = summary.coins + pSummary.coins;
  const groups = groupChallenges(list);
  const done = list.filter((c) => c.claimed).length;
  const daily = periodic.filter((c) => c.period === "daily");
  const weekly = periodic.filter((c) => c.period === "weekly");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["challenges"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  };

  // When a period ends, fetch the new rotation.
  const ends = periodic.map((c) => new Date(c.ends_at).getTime());
  const expired = ends.some((t) => t <= now);
  const lastExpired = useRef(false);
  useEffect(() => {
    if (expired && !lastExpired.current) qc.invalidateQueries({ queryKey: ["challenges", "periodic"] });
    lastExpired.current = expired;
  }, [expired, qc]);

  const claimOne = useMutation({
    mutationFn: async (c: Challenge) => {
      const { data, error } = await supabase.rpc("claim_challenge", { _challenge_id: c.challenge_id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (coins, c) => { sfx.coins(6); toast.success(`Défi « ${c.title} » : +${coins} pièces`); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const claimPeriodic = useMutation({
    mutationFn: async (c: PeriodicChallenge) => {
      const { data, error } = await supabase.rpc("claim_periodic_challenge", { _challenge_id: c.challenge_id });
      if (error) throw error;
      return data as { coins: number; packs: number };
    },
    onSuccess: (r, c) => {
      sfx.coins(6);
      if (r.packs > 0) setTimeout(() => sfx.sparkle(), 220);
      const parts = [r.coins > 0 && `+${r.coins} pièces`, r.packs > 0 && `+${packText(r.packs, c.reward_pack_name)}`].filter(Boolean);
      toast.success(`Défi « ${c.title} » : ${parts.join(" et ")}`);
      refresh();
    },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const claimAll = useMutation({
    mutationFn: async () => {
      const [a, b] = await Promise.all([
        summary.count > 0 ? supabase.rpc("claim_all_challenges") : Promise.resolve({ data: { claimed: 0, coins: 0 }, error: null }),
        pSummary.count > 0 ? supabase.rpc("claim_all_periodic_challenges") : Promise.resolve({ data: { claimed: 0, coins: 0, packs: 0 }, error: null }),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      const x = a.data as { claimed: number; coins: number };
      const y = b.data as { claimed: number; coins: number; packs: number };
      return { claimed: x.claimed + y.claimed, coins: x.coins + y.coins, packs: y.packs };
    },
    onSuccess: (r) => {
      sfx.coins(Math.min(14, 4 + r.claimed));
      if (r.packs > 0) setTimeout(() => sfx.sparkle(), 260);
      const parts = [r.coins > 0 && `+${r.coins} pièces`, r.packs > 0 && `+${r.packs} pack${r.packs > 1 ? "s" : ""}`].filter(Boolean);
      toast.success(`${r.claimed} défi${r.claimed > 1 ? "s" : ""} récupéré${r.claimed > 1 ? "s" : ""} : ${parts.join(" et ")}`);
      refresh();
    },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const busy = claimOne.isPending || claimAll.isPending || claimPeriodic.isPending;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl text-gold">Défis</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chaque jour et chaque semaine, de nouveaux défis te font gagner des packs et des pièces. Les paliers de collection, eux, restent pour toujours.
          </p>
        </div>
        <Button
          disabled={totalReady === 0 || busy}
          onClick={() => claimAll.mutate()}
          className="h-auto bg-gold px-5 py-2.5 font-display text-lg text-primary-foreground shadow-gold disabled:opacity-40"
        >
          <Gift className="h-4 w-4" />
          {totalReady > 0 ? (
            <>Tout récupérer · +{totalCoins}{pSummary.packCount > 0 && <> · +{pSummary.packCount} pack{pSummary.packCount > 1 ? "s" : ""}</>}</>
          ) : "Rien à récupérer"}
        </Button>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <PeriodSection
          icon={<Sun className="h-5 w-5 text-primary" />}
          title="Défis du jour"
          items={daily}
          now={now}
          loading={loadingPeriodic}
          busy={busy}
          onClaim={(c) => claimPeriodic.mutate(c)}
        />
        <PeriodSection
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
          title="Défis de la semaine"
          items={weekly}
          now={now}
          loading={loadingPeriodic}
          busy={busy}
          onClaim={(c) => claimPeriodic.mutate(c)}
        />
      </div>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-4xl tracking-wide text-foreground">Paliers de collection</h2>
          <p className="text-sm text-muted-foreground">Chaque carte que tu tires dans un pack fait avancer ces défis, doublons compris.</p>
        </div>
        {list.length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {done} / {list.length} défis terminés
          </p>
        )}
      </div>

      {isLoading && <p className="mt-10 text-center text-muted-foreground">Chargement des défis…</p>}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section
            key={g.key}
            className="rounded-xl border border-border bg-card p-4"
            style={{ ["--accent" as string]: ACCENT[g.key] ?? "var(--primary)" }}
          >
            <header className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-[color:var(--accent)]" />
              <h3 className="font-display text-2xl tracking-wide text-[color:var(--accent)]">{g.label}</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {g.items[0]?.progress ?? 0} carte{(g.items[0]?.progress ?? 0) > 1 ? "s" : ""} obtenue{(g.items[0]?.progress ?? 0) > 1 ? "s" : ""}
              </span>
            </header>
            <ul className="space-y-2">
              {g.items.map((c) => (
                <ChallengeRow key={c.challenge_id} c={c} busy={busy} onClaim={() => claimOne.mutate(c)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function PeriodSection({ icon, title, items, now, loading, busy, onClaim }: {
  icon: ReactNode; title: string; items: PeriodicChallenge[]; now: number; loading: boolean; busy: boolean;
  onClaim: (c: PeriodicChallenge) => void;
}) {
  const endsAt = items[0]?.ends_at;
  return (
    <section className="rounded-xl border border-primary/40 bg-card p-4 shadow-[0_0_24px_-12px_var(--primary)]" style={{ ["--accent" as string]: "var(--primary)" }}>
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-2xl tracking-wide text-primary">{title}</h2>
        {endsAt && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" title="Les défis changent à minuit (heure de Paris)">
            <Clock className="h-3.5 w-3.5" /> Nouveaux dans {timeLeft(endsAt, now)}
          </span>
        )}
      </header>
      {loading && <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>}
      {!loading && items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aucun défi pour le moment.</p>}
      <ul className="space-y-2">
        {items.map((c) => <PeriodicRow key={c.challenge_id} c={c} busy={busy} onClaim={() => onClaim(c)} />)}
      </ul>
    </section>
  );
}

function PeriodicRow({ c, busy, onClaim }: { c: PeriodicChallenge; busy: boolean; onClaim: () => void }) {
  const state = challengeState(c);
  const pct = Math.round(progressRatio(c) * 100);
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background/60 p-3 transition",
        state === "claimable" ? "border-primary shadow-[0_0_18px_-6px_var(--primary)]" : "border-border",
        state === "claimed" && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold">{c.title}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.min(c.progress, c.target)} / {c.target}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{periodicGoalText(c)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex w-32 shrink-0 flex-col items-end gap-1">
        {c.reward_coins > 0 && (
          <span className="flex items-center gap-1 text-sm font-bold text-primary"><Coins className="h-4 w-4" /> {c.reward_coins}</span>
        )}
        {c.reward_packs > 0 && (
          <span className="flex items-center gap-1 text-right text-xs font-bold text-foreground">
            <Package className="h-3.5 w-3.5 shrink-0 text-primary" /> {packText(c.reward_packs, c.reward_pack_name)}
          </span>
        )}
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

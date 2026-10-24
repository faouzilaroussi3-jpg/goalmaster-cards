import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Coins, Loader2, Package, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRarities } from "@/lib/rarity";
import { packText, periodicGoalText, timeLeft } from "@/lib/periodic-challenges";
import {
  DURATION_PRESETS, PACKS_MAX, SPECIAL_METRICS, TITLE_MAX, durationMinutes, specialError, specialStatus,
  type SpecialForm, type SpecialMetric,
} from "@/lib/special-challenges";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const chip = "rounded-full px-3 py-1 text-xs font-bold transition";

const EMPTY: SpecialForm = {
  title: "", metric: "packs", rarity: "legendary", version: "alt", target: 5,
  coins: 300, packKey: "", packs: 0, amount: 24, unit: "hours",
};

export function ChallengesAdmin() {
  const qc = useQueryClient();
  const rarities = useRarities().filter((r) => r.key !== "secret_ultimate");
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: packTypes = [] } = useQuery({
    queryKey: ["admin-gift-packs"],
    queryFn: async () => (await supabase.from("pack_types").select("key, name").eq("archived", false).order("sort_order")).data ?? [],
  });
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-special-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("periodic_challenges")
        .select("id, title, metric, rarity, version, target, reward_coins, reward_pack_key, reward_packs, starts_at, ends_at")
        .eq("period", "special").order("starts_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const packKey = f.packKey || packTypes[0]?.key || "";
  const full = { ...f, packKey };
  const error = specialError(full);
  const set = (o: Partial<SpecialForm>) => setF((x) => ({ ...x, ...o }));
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const packName = (k: string | null) => packTypes.find((p) => p.key === k)?.name ?? k;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-special-challenges"] });
    qc.invalidateQueries({ queryKey: ["challenges", "periodic"] });
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (error) { toast.error(error); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc("admin_create_special_challenge", {
      _title: full.title.trim(),
      _metric: full.metric,
      _rarity: (full.metric === "rarity" ? full.rarity : null) as string,
      _version: (full.metric === "version" ? full.version : null) as string,
      _target: full.target,
      _reward_coins: full.coins,
      _reward_pack_key: (full.packs > 0 ? packKey : null) as string,
      _reward_packs: full.packs,
      _minutes: durationMinutes(full.amount, full.unit),
    });
    setSaving(false);
    if (err) { sfx.error(); toast.error(err.message); return; }
    sfx.coins(4);
    toast.success(`Défi « ${full.title.trim()} » publié`, { description: "Tous les joueurs le voient dans Défis jusqu'à la fin de sa durée." });
    setF({ ...EMPTY, packKey });
    refresh();
  }

  async function end(id: string, title: string) {
    if (!window.confirm(`Terminer « ${title} » maintenant ? Il disparaîtra pour tous les joueurs.`)) return;
    const { error: err } = await supabase.rpc("admin_end_special_challenge", { _challenge_id: id });
    if (err) { toast.error(err.message); return; }
    toast.success("Défi terminé");
    refresh();
  }

  const live = list.filter((c) => specialStatus(c, now) === "live");
  const ended = list.filter((c) => specialStatus(c, now) === "ended");
  const preview = periodicGoalText({ metric: full.metric, rarity: full.rarity, version: full.version, target: full.target || 0 });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <form onSubmit={create} className="panel space-y-4 p-4">
        <h3 className="flex items-center gap-2 text-2xl"><Sparkles className="h-5 w-5 text-primary" /> Nouveau défi spécial</h3>

        <label className="block space-y-1 text-sm font-semibold">
          Titre
          <input className={`${inp} w-full`} maxLength={TITLE_MAX} placeholder="Ex. Week-end Légendaire" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            Objectif
            <select className={`${inp} w-full`} value={f.metric} onChange={(e) => set({ metric: e.target.value as SpecialMetric })}>
              {SPECIAL_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            Nombre à atteindre
            <input className={`${inp} w-full`} type="number" min={1} value={f.target} onChange={(e) => set({ target: num(e.target.value) })} />
          </label>
          {f.metric === "rarity" && (
            <label className="space-y-1 text-sm font-semibold sm:col-span-2">
              Rareté
              <select className={`${inp} w-full`} value={f.rarity} onChange={(e) => set({ rarity: e.target.value })}>
                {rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
          )}
          {f.metric === "version" && (
            <label className="space-y-1 text-sm font-semibold sm:col-span-2">
              Version
              <select className={`${inp} w-full`} value={f.version} onChange={(e) => set({ version: e.target.value as "alt" | "shiny" })}>
                <option value="alt">Légendaire ALT</option>
                <option value="shiny">Secrète Légendaire Shiny</option>
              </select>
            </label>
          )}
        </div>
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">Les joueurs verront : <b className="text-foreground">{preview}</b></p>

        <div className="space-y-1">
          <p className="text-sm font-semibold">Récompense</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Pièces
              <input className={`${inp} w-full`} type="number" min={0} value={f.coins} onChange={(e) => set({ coins: num(e.target.value) })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Packs
              <input className={`${inp} w-full`} type="number" min={0} max={PACKS_MAX} value={f.packs} onChange={(e) => set({ packs: num(e.target.value) })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Pack offert
              <select className={`${inp} w-full`} value={packKey} disabled={f.packs === 0} onChange={(e) => set({ packKey: e.target.value })}>
                {packTypes.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Durée avant disparition</p>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((p) => {
              const on = p.amount === f.amount && p.unit === f.unit;
              return (
                <button key={p.label} type="button" onClick={() => set({ amount: p.amount, unit: p.unit })}
                  className={cn(chip, on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-primary/30")}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input className={`${inp} w-28`} type="number" min={1} value={f.amount} onChange={(e) => set({ amount: Math.max(0, Number(e.target.value) || 0) })} aria-label="Durée" />
            <select className={inp} value={f.unit} onChange={(e) => set({ unit: e.target.value as SpecialForm["unit"] })} aria-label="Unité">
              <option value="hours">heure(s)</option>
              <option value="days">jour(s)</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Le défi commence dès sa création. Seuls les packs et duels joués à partir de ce moment comptent. Entre 1 heure et 90 jours.</p>
        </div>

        {error && f.title.trim() && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={saving || !!error} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-bold text-primary-foreground disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Publier le défi
        </button>
      </form>

      <section className="panel space-y-4 p-4">
        <h3 className="text-2xl">Défis spéciaux</h3>
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">Aucun défi spécial pour l'instant.</p>}
        {live.length > 0 && (
          <ul className="space-y-2">
            {live.map((c) => (
              <li key={c.id} className="rounded-lg border border-primary/50 bg-background/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{periodicGoalText(c)}</p>
                  </div>
                  <button onClick={() => end(c.id, c.title)} className="flex shrink-0 items-center gap-1 text-xs font-bold text-destructive">
                    <Square className="h-3 w-3" /> Terminer
                  </button>
                </div>
                <Rewards c={c} packName={packName} />
                <p className="mt-1 flex items-center gap-1 text-xs text-primary"><Clock className="h-3.5 w-3.5" /> Disparaît dans {timeLeft(c.ends_at!, now)}</p>
              </li>
            ))}
          </ul>
        )}
        {ended.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terminés</p>
            <ul className="space-y-1.5">
              {ended.map((c) => (
                <li key={c.id} className="rounded-lg bg-secondary/40 p-2.5 opacity-70">
                  <p className="truncate text-sm font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {periodicGoalText(c)} · fini le {new Date(c.ends_at!).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Rewards({ c, packName }: { c: { reward_coins: number; reward_packs: number; reward_pack_key: string | null }; packName: (k: string | null) => string | null }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
      {c.reward_coins > 0 && <span className="flex items-center gap-1 text-primary"><Coins className="h-3.5 w-3.5" /> {c.reward_coins}</span>}
      {c.reward_packs > 0 && <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 text-primary" /> {packText(c.reward_packs, packName(c.reward_pack_key))}</span>}
    </div>
  );
}

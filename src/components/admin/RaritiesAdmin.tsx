import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlayerCard } from "@/components/PlayerCard";
import { RARITIES_QUERY_KEY } from "@/components/RarityRegistry";
import { effectBase, effectStyle, rarityMeta, useRarities, type CardData, type RarityEffect, type RarityInfo } from "@/lib/rarity";
import { canDeleteRarity, LABEL_MAX, RARITY_EFFECTS, rarityDraftError, SHORT_MAX } from "@/lib/rarity-admin";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const DEFAULT_TINT = "#ff3d8b";

/** Create admin rarities (name, sigle, visual effect borrowed from a built-in rarity or one of the extra styles, optional tint, place in the order) and delete them. */
export function RaritiesAdmin() {
  const rarities = useRarities();
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery({
    queryKey: ["admin-rarity-cards"],
    queryFn: async () => (await supabase.from("cards").select("id, rarity, image_url, name, club, nationality, pos, rating").order("rating", { ascending: false })).data ?? [],
  });
  const counts = useMemo(() => cards.reduce<Record<string, number>>((m, c) => ({ ...m, [c.rarity]: (m[c.rarity] ?? 0) + 1 }), {}), [cards]);
  const sample: CardData = useMemo(() => {
    const c = cards.find((x) => x.image_url && x.rarity !== "secret_ultimate") ?? cards[0];
    return c ? { ...c, version: "normal" } : { name: "Joueur exemple", club: "Goalmaster FC", nationality: "France", pos: "BU", rating: 88, rarity: "common", image_url: null };
  }, [cards]);

  const [f, setF] = useState({ label: "", short: "", effect: "legendary" as RarityEffect, tint: false, color: DEFAULT_TINT, after: "legendary", duplicateCoins: 200 });
  const [busy, setBusy] = useState(false);
  const draft = { label: f.label, short: f.short, effect: f.effect, color: f.tint ? f.color : "", duplicateCoins: f.duplicateCoins };
  const problem = rarityDraftError(draft);
  const preview: RarityInfo = {
    key: "preview", label: f.label.trim() || "Nouvelle rareté", short: f.short.trim().toUpperCase() || "?",
    tier: rarityMeta(effectBase(f.effect) ?? "common").tier, rank: 0, fx: effectBase(f.effect) ?? "common", style: effectStyle(f.effect),
    color: f.tint ? f.color : null, builtin: false,
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: RARITIES_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["admin-rarity-cards"] });
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
    qc.invalidateQueries({ queryKey: ["admin-packs"] });
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_rarity", {
      _label: draft.label.trim(), _short: draft.short.trim(), _effect: draft.effect, _color: draft.color, _after_key: f.after, _duplicate_coins: draft.duplicateCoins,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rareté « ${draft.label.trim()} » créée. Donne-lui des chances de tirage dans Packs & taux.`);
    setF({ ...f, label: "", short: "" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="panel grid gap-6 p-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <h3 className="text-2xl">Nouvelle rareté</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="text-xs text-muted-foreground">Nom
              <input className={`${inp} mt-1 w-full`} maxLength={LABEL_MAX} required value={f.label} placeholder="Ex. Mythique" onChange={(e) => setF({ ...f, label: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">Sigle
              <input className={`${inp} mt-1 w-full uppercase`} maxLength={SHORT_MAX} required value={f.short} placeholder="Ex. M" onChange={(e) => setF({ ...f, short: e.target.value })} />
            </label>
          </div>
          <fieldset>
            <legend className="mb-1 text-xs text-muted-foreground">Effet visuel appliqué à toutes ses cartes</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {RARITY_EFFECTS.map((fx) => (
                <label key={fx.fx} className={`flex cursor-pointer gap-2 rounded-lg border p-2 text-sm ${f.effect === fx.fx ? "border-primary bg-primary/10" : "border-border"}`}>
                  <input type="radio" name="effect" className="mt-1" checked={f.effect === fx.fx} onChange={() => setF({ ...f, effect: fx.fx })} />
                  <span><b className="text-foreground">{fx.label}</b>{fx.isNew && <span className="ml-1.5 rounded bg-primary/20 px-1 text-[10px] font-bold uppercase text-primary">Nouveau</span>}<span className="block text-xs text-muted-foreground">{fx.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">Couleur
              <span className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={f.tint} onChange={(e) => setF({ ...f, tint: e.target.checked })} aria-label="Utiliser une couleur personnalisée" />
                <input type="color" className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent disabled:opacity-40" disabled={!f.tint} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
                <span>{f.tint ? f.color : "Couleur de l'effet"}</span>
              </span>
            </label>
            <label className="text-xs text-muted-foreground">Placée après
              <select className={`${inp} mt-1 w-full`} value={f.after} onChange={(e) => setF({ ...f, after: e.target.value })}>
                {rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Pièces par doublon
              <input type="number" min={0} max={100000} className={`${inp} mt-1 w-full`} value={f.duplicateCoins} onChange={(e) => setF({ ...f, duplicateCoins: Math.round(+e.target.value) })} />
            </label>
          </div>
          {problem && f.label && <p className="text-sm text-destructive">{problem}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-gold py-2 font-bold text-primary-foreground disabled:opacity-50">Créer la rareté</button>
          <p className="text-xs text-muted-foreground">Ensuite, choisis ses cartes dans Cartes (champ Rareté) et ses chances de tirage dans Packs & taux.</p>
        </div>
        <div className="mx-auto w-48 pt-6 md:w-full">
          <p className="mb-6 text-center text-xs uppercase text-muted-foreground">Aperçu</p>
          <PlayerCard card={{ ...sample, rarity: "preview" }} rarityInfo={preview} />
        </div>
      </form>

      <section className="panel p-4">
        <h3 className="mb-3 text-2xl">Raretés ({rarities.length})</h3>
        <ul className="divide-y divide-border">
          {rarities.map((r) => <RarityRowItem key={r.key} r={r} count={counts[r.key] ?? 0} others={rarities.filter((o) => o.key !== r.key)} onDone={refresh} />)}
        </ul>
      </section>
    </div>
  );
}

function RarityRowItem({ r, count, others, onDone }: { r: RarityInfo; count: number; others: RarityInfo[]; onDone: () => void }) {
  const [moveTo, setMoveTo] = useState<string>(others.find((o) => o.rank < r.rank && o.builtin)?.key ?? others[0]?.key ?? "");
  const [confirm, setConfirm] = useState(false);
  const effect = RARITY_EFFECTS.find((e) => e.fx === (r.style ?? r.fx));
  async function remove() {
    if (!canDeleteRarity(r, moveTo)) return;
    const { data, error } = await supabase.rpc("admin_delete_rarity", { _key: r.key, _move_to: moveTo });
    if (error) { toast.error(error.message); return; }
    toast.success(`Rareté « ${r.label} » supprimée${data ? `, ${data} carte${data > 1 ? "s" : ""} déplacée${data > 1 ? "s" : ""} vers ${rarityMeta(moveTo).label}` : ""}.`);
    onDone();
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-sm">
      <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-border px-1.5 font-display" style={r.color ? { borderColor: r.color, color: r.color } : undefined}>{r.short}</span>
      <span className="min-w-0 flex-1">
        <b className="text-foreground">{r.label}</b>
        <span className="block text-xs text-muted-foreground">Effet : {effect?.label ?? r.fx} · {count} carte{count > 1 ? "s" : ""}{r.builtin ? " · rareté de base" : ""}</span>
      </span>
      {!r.builtin && (confirm ? (
        <span className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Ses cartes deviennent
            <select className={`${inp} ml-1 py-1`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={remove} disabled={!canDeleteRarity(r, moveTo)} className="rounded-lg bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">Supprimer</button>
          <button type="button" onClick={() => setConfirm(false)} className="text-xs text-muted-foreground">Annuler</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
      ))}
    </li>
  );
}

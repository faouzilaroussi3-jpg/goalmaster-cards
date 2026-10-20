import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Power, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlayerCard } from "@/components/PlayerCard";
import { RARITIES_QUERY_KEY } from "@/components/RarityRegistry";
import { effectBase, effectStyle, rarityMeta, useRarities, type CardData, type RarityEffect, type RarityInfo } from "@/lib/rarity";
import { canDeleteRarity, LABEL_MAX, RARITY_EFFECTS, rarityDraftError, SHORT_MAX } from "@/lib/rarity-admin";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const DEFAULT_TINT = "#ff3d8b";

interface Fields { label: string; short: string; effect: RarityEffect; tint: boolean; color: string; duplicateCoins: number }

const toDraft = (f: Fields) => ({ label: f.label, short: f.short, effect: f.effect, color: f.tint ? f.color : "", duplicateCoins: f.duplicateCoins });

function previewInfo(f: Fields, base?: RarityInfo): RarityInfo {
  const fx = effectBase(f.effect) ?? "common";
  return {
    key: "preview", label: f.label.trim() || "Nouvelle rareté", short: f.short.trim().toUpperCase() || "?",
    tier: base?.builtin ? base.tier : rarityMeta(fx).tier, rank: 0, fx, play: base?.play ?? fx, style: effectStyle(f.effect),
    color: f.tint ? f.color : null, builtin: base?.builtin ?? false, active: true,
  };
}

/** Create, edit and delete rarities. Every rarity (built-in ones included) can change name, sigle, look, tint and duplicate coins. */
export function RaritiesAdmin() {
  const rarities = useRarities();
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery({
    queryKey: ["admin-rarity-cards"],
    queryFn: async () => (await supabase.from("cards").select("id, rarity, image_url, name, club, nationality, pos, rating").order("rating", { ascending: false })).data ?? [],
  });
  const { data: coinRows = [] } = useQuery({
    queryKey: ["admin-rarity-rows"],
    queryFn: async () => (await supabase.from("rarities").select("key, duplicate_coins, effect")).data ?? [],
  });
  const rows = useMemo(() => Object.fromEntries(coinRows.map((r) => [r.key, r])), [coinRows]);
  const counts = useMemo(() => cards.reduce<Record<string, number>>((m, c) => ({ ...m, [c.rarity]: (m[c.rarity] ?? 0) + 1 }), {}), [cards]);
  const sampleFor = (key?: string): CardData => {
    const c = (key && cards.find((x) => x.rarity === key && x.image_url)) || cards.find((x) => x.image_url && x.rarity !== "secret_ultimate") || cards[0];
    return c ? { ...c, version: "normal" } : { name: "Joueur exemple", club: "Goalmaster FC", nationality: "France", pos: "BU", rating: 88, rarity: "common", image_url: null };
  };

  const [f, setF] = useState<Fields>({ label: "", short: "", effect: "legendary", tint: false, color: DEFAULT_TINT, duplicateCoins: 200 });
  const [after, setAfter] = useState("legendary");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const draft = toDraft(f);
  const problem = rarityDraftError(draft);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: RARITIES_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["admin-rarity-cards"] });
    qc.invalidateQueries({ queryKey: ["admin-rarity-rows"] });
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
    qc.invalidateQueries({ queryKey: ["admin-packs"] });
  };

  async function create(e: FormEvent) {
    e.preventDefault();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_rarity", {
      _label: draft.label.trim(), _short: draft.short.trim(), _effect: draft.effect, _color: draft.color, _after_key: after, _duplicate_coins: draft.duplicateCoins,
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
          <RarityFields f={f} setF={setF} />
          <label className="block text-xs text-muted-foreground">Placée après
            <select className={`${inp} mt-1 w-full sm:w-1/2`} value={after} onChange={(e) => setAfter(e.target.value)}>
              {rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          {problem && f.label && <p className="text-sm text-destructive">{problem}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-gold py-2 font-bold text-primary-foreground disabled:opacity-50">Créer la rareté</button>
          <p className="text-xs text-muted-foreground">Ensuite, choisis ses cartes dans Cartes (champ Rareté) et ses chances de tirage dans Packs & taux.</p>
        </div>
        <div className="mx-auto w-48 pt-6 md:w-full">
          <p className="mb-6 text-center text-xs uppercase text-muted-foreground">Aperçu</p>
          <PlayerCard card={{ ...sampleFor(), rarity: "preview" }} rarityInfo={previewInfo(f)} />
        </div>
      </form>

      <section className="panel p-4">
        <h3 className="mb-1 text-2xl">Raretés ({rarities.length})</h3>
        <p className="mb-3 text-xs text-muted-foreground">Clique sur « Modifier » pour changer le nom, le sigle, l'effet visuel ou la couleur d'une rareté : toutes ses cartes changent aussitôt. Le bouton « Activée / Désactivée » arrête ou relance la sortie de ses cartes dans les packs ; les joueurs gardent les cartes qu'ils ont déjà.</p>
        <ul className="divide-y divide-border">
          {rarities.map((r) => (
            <RarityRowItem
              key={r.key}
              r={r}
              count={counts[r.key] ?? 0}
              duplicateCoins={rows[r.key]?.duplicate_coins ?? 0}
              effect={(rows[r.key]?.effect ?? r.style ?? r.fx) as RarityEffect}
              sample={sampleFor(r.key)}
              others={rarities.filter((o) => o.key !== r.key)}
              editing={editing === r.key}
              onEdit={(on) => setEditing(on ? r.key : null)}
              onDone={refresh}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RarityFields({ f, setF }: { f: Fields; setF: (f: Fields) => void }) {
  return (
    <>
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
              <input type="radio" className="mt-1" checked={f.effect === fx.fx} onChange={() => setF({ ...f, effect: fx.fx })} />
              <span><b className="text-foreground">{fx.label}</b>{fx.isNew && <span className="ml-1.5 rounded bg-primary/20 px-1 text-[10px] font-bold uppercase text-primary">Nouveau</span>}<span className="block text-xs text-muted-foreground">{fx.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Couleur
          <span className="mt-1 flex items-center gap-2">
            <input type="checkbox" checked={f.tint} onChange={(e) => setF({ ...f, tint: e.target.checked })} aria-label="Utiliser une couleur personnalisée" />
            <input type="color" className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent disabled:opacity-40" disabled={!f.tint} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
            <span>{f.tint ? f.color : "Couleur de l'effet"}</span>
          </span>
        </label>
        <label className="text-xs text-muted-foreground">Pièces par doublon
          <input type="number" min={0} max={100000} className={`${inp} mt-1 w-full`} value={f.duplicateCoins} onChange={(e) => setF({ ...f, duplicateCoins: Math.round(+e.target.value) })} />
        </label>
      </div>
    </>
  );
}

function RarityRowItem({ r, count, duplicateCoins, effect, sample, others, editing, onEdit, onDone }: {
  r: RarityInfo; count: number; duplicateCoins: number; effect: RarityEffect; sample: CardData; others: RarityInfo[];
  editing: boolean; onEdit: (on: boolean) => void; onDone: () => void;
}) {
  const [moveTo, setMoveTo] = useState<string>(others.find((o) => o.rank < r.rank && o.builtin)?.key ?? others[0]?.key ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const current: Fields = { label: r.label, short: r.short, effect, tint: !!r.color, color: r.color ?? DEFAULT_TINT, duplicateCoins };
  const [f, setF] = useState<Fields>(current);
  const effectLabel = RARITY_EFFECTS.find((e) => e.fx === effect)?.label ?? effect;
  const draft = toDraft(f);
  const problem = rarityDraftError(draft);
  const original = r.builtin ? RARITY_EFFECTS.find((e) => e.fx === r.key) : undefined;

  function startEdit() { setF(current); setConfirm(false); onEdit(true); }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_rarity", {
      _key: r.key, _label: draft.label.trim(), _short: draft.short.trim(), _effect: draft.effect, _color: draft.color, _duplicate_coins: draft.duplicateCoins,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rareté « ${draft.label.trim()} » mise à jour sur ${count} carte${count > 1 ? "s" : ""}.`);
    onEdit(false);
    onDone();
  }

  async function toggleActive() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_rarity_active", { _key: r.key, _active: !r.active });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(r.active ? `« ${r.label} » désactivée : ses cartes ne sortent plus des packs.` : `« ${r.label} » réactivée : ses cartes sortent de nouveau des packs.`);
    onDone();
  }

  async function remove() {
    if (!canDeleteRarity(r, moveTo)) return;
    const { data, error } = await supabase.rpc("admin_delete_rarity", { _key: r.key, _move_to: moveTo });
    if (error) { toast.error(error.message); return; }
    toast.success(`Rareté « ${r.label} » supprimée${data ? `, ${data} carte${data > 1 ? "s" : ""} déplacée${data > 1 ? "s" : ""} vers ${rarityMeta(moveTo).label}` : ""}.`);
    onDone();
  }

  return (
    <li className="py-2 text-sm">
      <div className={`flex flex-wrap items-center gap-3 ${r.active ? "" : "opacity-60"}`}>
        <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-border px-1.5 font-display" style={r.color ? { borderColor: r.color, color: r.color } : undefined}>{r.short}</span>
        <span className="min-w-0 flex-1">
          <b className="text-foreground">{r.label}</b>
          {!r.active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Désactivée</span>}
          <span className="block text-xs text-muted-foreground">Effet : {effectLabel} · {count} carte{count > 1 ? "s" : ""}{r.builtin ? " · rareté de base" : ""}</span>
        </span>
        {!editing && (
          <button
            type="button"
            onClick={toggleActive}
            disabled={busy}
            role="switch"
            aria-checked={r.active}
            aria-label={`${r.active ? "Désactiver" : "Activer"} ${r.label}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${r.active ? "border-primary/60 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Power className="h-3.5 w-3.5" /> {r.active ? "Activée" : "Désactivée"}
          </button>
        )}
        {!editing && (
          <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-xs text-primary"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
        )}
        {!r.builtin && !editing && (confirm ? (
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
      </div>
      {editing && (
        <form onSubmit={save} aria-label={`Modifier ${r.label}`} className="mt-3 grid gap-6 rounded-lg border border-primary/40 bg-background/40 p-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <RarityFields f={f} setF={setF} />
            {original && f.effect !== r.key && (
              <button type="button" onClick={() => setF({ ...f, effect: r.key as RarityEffect, tint: false })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Remettre l'effet d'origine ({original.label})
              </button>
            )}
            {r.builtin && <p className="text-xs text-muted-foreground">Seule l'apparence change : en duel, ses cartes gardent la force et le coût d'une {r.label}.</p>}
            {problem && <p className="text-sm text-destructive">{problem}</p>}
            <div className="flex gap-2">
              <button disabled={busy || !!problem} className="flex-1 rounded-lg bg-gold py-2 font-bold text-primary-foreground disabled:opacity-50">Enregistrer</button>
              <button type="button" onClick={() => onEdit(false)} className="rounded-lg border border-border px-4 text-sm text-muted-foreground">Annuler</button>
            </div>
          </div>
          <div className="mx-auto w-48 md:w-full">
            <p className="mb-6 text-center text-xs uppercase text-muted-foreground">Aperçu</p>
            <PlayerCard card={{ ...sample, rarity: "preview" }} rarityInfo={previewInfo(f, r)} />
          </div>
        </form>
      )}
    </li>
  );
}

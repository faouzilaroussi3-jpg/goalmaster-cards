import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRarities } from "@/lib/rarity";
import { exactChances, PACK_ARTS, PACK_EFFECTS, packDraftError, packLookOf, type PackArt, type PackEffect } from "@/lib/pack-look";
import { PackFx, packImageOf, packImgStyle } from "@/components/PackArt";
import { PhotoField } from "@/components/admin/CardsAdmin";
import { cn } from "@/lib/utils";
import { CardBack } from "@/components/CardBack";
import { BACK_EXCLUDED_EFFECTS, cardBackOf, type CardBackLook } from "@/lib/card-back";
import { RARITY_EFFECTS } from "@/lib/rarity-admin";
import { CARD_SHAPES, type RarityEffect } from "@/lib/rarity";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";

interface PackRow {
  id: string; key: string; name: string; description: string | null; slot_count: number; slot_rates: unknown; version_rates: unknown;
  regen_minutes: number; max_stock: number; initial_stock: number; price_coins: number; xp_reward: number; active: boolean;
  sort_order: number; art: string; tint: string | null; effect: string; image_url: string | null; archived: boolean; card_back: unknown;
}

/** Admin → Packs: create, rename, customise (art, colour, effect, own picture), choose rarities and exact rates, delete. */
export function PacksAdmin() {
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery({
    queryKey: ["admin-packs"],
    queryFn: async () => ((await supabase.from("pack_types").select("*").eq("archived", false).order("sort_order")).data ?? []) as PackRow[],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-packs"] }); qc.invalidateQueries({ queryKey: ["packs"] }); qc.invalidateQueries({ queryKey: ["admin-gift-packs"] }); };

  async function create() {
    const key = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const { error } = await supabase.from("pack_types").insert({
      key, name: "Nouveau pack", description: "5 cartes, de la moins rare à la plus rare.", slot_count: 5,
      slot_rates: { common: 60, uncommon: 25, rare: 12, super_rare: 3 }, bonus_rates: {}, version_rates: { alt: 0, shiny: 0 },
      regen_minutes: 0, max_stock: 10, initial_stock: 0, price_coins: 1000, xp_reward: 10, active: false,
      sort_order: Math.max(0, ...packs.map((p) => p.sort_order)) + 1, art: "classic", effect: "glow", tint: "#7c3aed",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pack créé (désactivé) : personnalise-le puis active-le");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Les taux sont exacts : chaque carte sort de la rareté tirée, selon la part de son taux dans le total.</p>
        <button onClick={create} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Nouveau pack</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {packs.map((p) => <PackEditor key={p.id} p={p} onSaved={refresh} />)}
      </div>
    </div>
  );
}

function PackEditor({ p, onSaved }: { p: PackRow; onSaved: () => void }) {
  const rarities = useRarities();
  const [d, setD] = useState({
    name: p.name, description: p.description ?? "", slot_count: p.slot_count, art: packLookOf(p).art, tint: p.tint ?? "",
    effect: packLookOf(p).effect, image_url: p.image_url ?? "",
  });
  const [rates, setRates] = useState<Record<string, number>>({ ...(p.slot_rates as Record<string, number>) });
  const [versions, setVersions] = useState<Record<string, number>>({ alt: 0, shiny: 0, ...(p.version_rates as Record<string, number>) });
  const [cfg, setCfg] = useState({ regen_minutes: p.regen_minutes, max_stock: p.max_stock, price_coins: p.price_coins, xp_reward: p.xp_reward, active: p.active });
  const [back, setBack] = useState<CardBackLook>(() => cardBackOf(p.card_back));
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const isActive = (k: string) => rarities.find((r) => r.key === k)?.active !== false;
  const chances = exactChances(rates, isActive);
  const look = packLookOf({ art: d.art, tint: d.tint || null, effect: d.effect, image_url: d.image_url || null });
  const error = packDraftError({ name: d.name, slot_count: d.slot_count, rates });

  async function save() {
    if (error) { toast.error(error); return; }
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(rates).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    const { error: e } = await supabase.from("pack_types").update({
      ...cfg, name: d.name.trim(), description: d.description.trim() || null, slot_count: d.slot_count,
      art: d.art, tint: d.tint || null, effect: d.effect, image_url: d.image_url.trim() || null,
      card_back: { color: back.color, effects: back.effects, shape: back.shape, image_url: back.image_url?.trim() || null },
      slot_rates: clean, version_rates: { alt: Number(versions["alt"]) || 0, shiny: Number(versions["shiny"]) || 0 },
    }).eq("id", p.id);
    setBusy(false);
    if (e) { toast.error(e.message); return; }
    toast.success("Pack enregistré");
    onSaved();
  }

  async function remove() {
    setBusy(true);
    const { data, error: e } = await supabase.rpc("admin_delete_pack", { _pack_id: p.id });
    setBusy(false);
    if (e) { toast.error(e.message); return; }
    toast.success(data === "archived" ? "Pack supprimé (gardé dans l'historique des ouvertures)" : "Pack supprimé");
    onSaved();
  }

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex gap-4">
        <div className="flex w-28 shrink-0 items-center justify-center py-4">
          <PackFx look={look} className="w-24">
            <img src={packImageOf(look)} alt={d.name} width={768} height={1152} className="block w-full" style={packImgStyle(look)} />
          </PackFx>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input className={`${inp} w-full font-display text-xl`} aria-label="Nom du pack" value={d.name} maxLength={40} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <textarea className={`${inp} w-full`} rows={2} aria-label="Description" placeholder="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Cartes par pack
            <input className={`${inp} w-20`} type="number" min={1} max={10} value={d.slot_count} onChange={(e) => setD({ ...d, slot_count: Math.round(+e.target.value) })} />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Visuel</p>
        <div className="flex flex-wrap items-center gap-2">
          {PACK_ARTS.map((a) => (
            <button key={a.key} type="button" onClick={() => setD({ ...d, art: a.key as PackArt })}
              className={cn("rounded-full px-3 py-1 text-xs font-bold", d.art === a.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{a.label}</button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Couleur
            <input type="color" aria-label="Couleur du pack" value={d.tint || "#ff3d9a"} onChange={(e) => setD({ ...d, tint: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent" />
          </label>
          {d.tint && <button type="button" onClick={() => setD({ ...d, tint: "" })} className="text-xs text-muted-foreground underline">couleur d'origine</button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PACK_EFFECTS.map((f) => (
            <button key={f.key} type="button" title={f.hint} onClick={() => setD({ ...d, effect: f.key as PackEffect })}
              className={cn("rounded-full px-3 py-1 text-xs font-bold", d.effect === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{f.label}</button>
          ))}
        </div>
        <div className="mt-2 grid"><PhotoField label="Image du pack (facultatif, remplace le visuel)" value={d.image_url} onChange={(v) => setD({ ...d, image_url: v })} /></div>
      </div>

      <CardBackEditor back={back} onChange={setBack} />

      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Raretés dans le pack · coche celles que tu veux et règle leur taux</p>
        {rarities.map((r) => {
          const on = (rates[r.key] ?? 0) > 0;
          return (
            <div key={r.key} className={cn("flex items-center gap-2 py-0.5 text-sm", !r.active && "opacity-50")}>
              <input type="checkbox" aria-label={`Mettre ${r.label} dans le pack`} checked={on}
                onChange={(e) => setRates({ ...rates, [r.key]: e.target.checked ? 1 : 0 })} />
              <span className="min-w-0 flex-1 truncate">{r.label}{!r.active && <span className="ml-1 text-xs text-muted-foreground">(désactivée)</span>}</span>
              <input className={`${inp} w-24`} type="number" step="0.001" min={0} disabled={!on} aria-label={`Taux ${r.label}`} value={rates[r.key] ?? 0}
                onChange={(e) => setRates({ ...rates, [r.key]: Math.max(0, +e.target.value) })} />
              <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">{chances[r.key] != null ? `${fmt(chances[r.key]!)} %` : "—"}</span>
            </div>
          );
        })}
        <p className="mt-1 text-xs text-muted-foreground">À droite : la vraie chance par carte. Exemple : 0,01 sur un total de 100 = 1 carte sur 10 000.</p>
      </div>

      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Versions spéciales (%)</p>
        {([["alt", "Légendaire → ALT"], ["shiny", "Secrète Légendaire → Shiny"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 py-0.5 text-sm">{l}
            <input className={`${inp} w-24`} type="number" step="0.1" min={0} max={100} value={versions[k] ?? 0} onChange={(e) => setVersions({ ...versions, [k]: Math.min(100, Math.max(0, +e.target.value)) })} />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <label>Recharge (min, 0 = aucune)<input className={`${inp} w-full`} type="number" min={0} value={cfg.regen_minutes} onChange={(e) => setCfg({ ...cfg, regen_minutes: +e.target.value })} /></label>
        <label>Stock max<input className={`${inp} w-full`} type="number" min={0} value={cfg.max_stock} onChange={(e) => setCfg({ ...cfg, max_stock: +e.target.value })} /></label>
        <label>Prix en pièces (0 = non achetable)<input className={`${inp} w-full`} type="number" min={0} value={cfg.price_coins} onChange={(e) => setCfg({ ...cfg, price_coins: +e.target.value })} /></label>
        <label>XP par ouverture<input className={`${inp} w-full`} type="number" min={0} value={cfg.xp_reward} onChange={(e) => setCfg({ ...cfg, xp_reward: +e.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> Pack visible et jouable par les joueurs</label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy || !!error} className="flex-1 rounded-lg bg-gold py-2 font-bold text-primary-foreground disabled:opacity-50">Enregistrer</button>
        {confirmDel ? (
          <>
            <button onClick={() => setConfirmDel(false)} className="rounded-lg bg-secondary px-3 text-sm font-bold">Annuler</button>
            <button onClick={remove} disabled={busy} className="rounded-lg bg-destructive px-3 text-sm font-bold text-destructive-foreground">Confirmer</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} aria-label={`Supprimer ${p.name}`} className="rounded-lg bg-secondary px-3 text-destructive"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

const fmt = (n: number) => (n >= 1 ? n.toFixed(1) : n >= 0.01 ? n.toFixed(3) : n.toPrecision(2)).replace(".", ",");

const BACK_EFFECTS = RARITY_EFFECTS.filter((e) => !BACK_EXCLUDED_EFFECTS.includes(e.fx));

/** Card back of this pack, shown face down while opening: colour, mixed effects, outline and an optional picture, with a live preview. */
function CardBackEditor({ back, onChange }: { back: CardBackLook; onChange: (b: CardBackLook) => void }) {
  const toggle = (fx: RarityEffect) =>
    onChange({ ...back, effects: back.effects.includes(fx) ? back.effects.filter((e) => e !== fx) : [...back.effects, fx].slice(0, 6) });
  return (
    <div>
      <p className="mb-1 text-xs uppercase text-muted-foreground">Dos des cartes (pendant l'ouverture)</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="mx-auto w-28 shrink-0 sm:mx-0">
          <div className="relative aspect-[5/7] w-full"><CardBack look={back} /></div>
          <button type="button" onClick={() => onChange(cardBackOf({}))} className="mt-2 w-full text-center text-xs text-muted-foreground underline">dos d'origine</button>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">Couleur
              <input type="color" aria-label="Couleur du dos" value={back.color ?? "#ff3d9a"} onChange={(e) => onChange({ ...back, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent" />
            </label>
            {back.color && <button type="button" onClick={() => onChange({ ...back, color: null })} className="underline">rose d'origine</button>}
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Forme</p>
            <div className="flex flex-wrap gap-1.5">
              {CARD_SHAPES.map((sh) => (
                <button key={sh.key} type="button" title={sh.hint} onClick={() => onChange({ ...back, shape: sh.key })}
                  className={cn("rounded-full px-3 py-1 text-xs font-bold", back.shape === sh.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{sh.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Effets (coche-en autant que tu veux, ils se mélangent){back.effects.length ? ` · ${back.effects.length} choisi${back.effects.length > 1 ? "s" : ""}` : ""}</p>
            <div className="flex flex-wrap gap-1.5">
              {BACK_EFFECTS.map((fx) => (
                <button key={fx.fx} type="button" title={fx.hint} onClick={() => toggle(fx.fx)} aria-pressed={back.effects.includes(fx.fx)}
                  className={cn("rounded-full px-3 py-1 text-xs font-bold", back.effects.includes(fx.fx) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{fx.label}</button>
              ))}
            </div>
          </div>
          <div className="grid"><PhotoField label="Image du dos (facultatif, remplace le logo GM)" value={back.image_url ?? ""} onChange={(v) => onChange({ ...back, image_url: v || null })} /></div>
        </div>
      </div>
    </div>
  );
}

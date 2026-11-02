import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TrophyKind } from "@/lib/ballon-dor";
import { useTrophyDesignRows } from "@/lib/ballon-dor-query";
import {
  cleanInscription, DEFAULT_DESIGNS, designError, designOf, FINISH_LABEL, INSCRIPTION_MAX, METAL_PRESETS, NAME_MAX, sameDesign, TROPHY_KINDS,
  type TrophyDesign, type TrophyFinish,
} from "@/lib/trophy-design";

const TrophyStudio = lazy(() => import("@/components/avatar/TrophyStudio"));
const inp = "w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";

function ColorField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets?: readonly { label: string; color: string }[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {presets?.map((p) => (
          <button key={p.color} type="button" title={p.label} aria-label={p.label} onClick={() => onChange(p.color)}
            className={`h-8 w-8 rounded-full border-2 ${value.toLowerCase() === p.color ? "border-primary" : "border-border"}`}
            style={{ background: p.color }} />
        ))}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent" aria-label={`${label} : autre couleur`} />
          Autre
        </label>
      </div>
    </div>
  );
}

/** Admin tab: see the three ceremony trophies in 3D and change their name, engraving, colours, finish and diamonds. */
export function TrophyDesignAdmin() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useTrophyDesignRows();
  const [kind, setKind] = useState<TrophyKind>("ballon");
  const saved = designOf(kind, rows);
  const [draft, setDraft] = useState<TrophyDesign>(saved);
  const [busy, setBusy] = useState(false);
  const savedKey = JSON.stringify(saved);
  useEffect(() => { setDraft(JSON.parse(savedKey)); }, [savedKey]);

  const set = <K extends keyof TrophyDesign>(k: K, v: TrophyDesign[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = !sameDesign(draft, saved);
  const custom = !sameDesign(saved, DEFAULT_DESIGNS[kind]);
  const err = designError(draft);

  async function save() {
    if (err) { toast.error(err); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_save_trophy_design", {
      _kind: kind, _name: draft.name.trim(), _inscription: draft.inscription.trim(), _metal: draft.metal, _base: draft.base,
      _gem: draft.gem, _accent: draft.accent, _finish: draft.finish, _diamonds: draft.diamonds,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Trophée enregistré");
    qc.invalidateQueries({ queryKey: ["trophy-designs"] });
  }
  async function reset() {
    if (!confirm("Remettre ce trophée comme à l'origine ?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_reset_trophy_design", { _kind: kind });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Trophée remis comme à l'origine");
    qc.invalidateQueries({ queryKey: ["trophy-designs"] });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Les trophées remis pendant la cérémonie. Ce que tu enregistres change le trophée partout : sur scène, dans les mains du gagnant et dans la vitrine des joueurs. Seuls les admins voient cet onglet.
      </p>
      <div className="flex flex-wrap gap-2">
        {TROPHY_KINDS.map((k) => (
          <button key={k} onClick={() => { if (dirty && !confirm("Tes changements non enregistrés seront perdus. Continuer ?")) return; setKind(k); }}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {designOf(k, rows).name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel relative h-[340px] overflow-hidden sm:h-[460px]">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Chargement du trophée…</div>}>
            <TrophyStudio kind={kind} design={draft} />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-display text-2xl text-gold drop-shadow">{draft.name || "…"}</div>
          {dirty && <div className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Aperçu non enregistré</div>}
        </div>

        <div className="panel space-y-4 p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nom du trophée</span>
            <input className={inp} value={draft.name} maxLength={NAME_MAX} onChange={(e) => set("name", e.target.value)} />
            <span className="block text-xs text-muted-foreground">Affiché pendant la cérémonie, dans les notifications et sur le profil des gagnants.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Inscription gravée sur le socle</span>
            <input className={inp} value={draft.inscription} maxLength={INSCRIPTION_MAX} placeholder="Vide = pas d'inscription" onChange={(e) => set("inscription", cleanInscription(e.target.value))} />
            <span className="block text-xs text-muted-foreground">{draft.inscription.length}/{INSCRIPTION_MAX} caractères, en majuscules.</span>
          </label>
          <ColorField label="Métal" value={draft.metal} onChange={(v) => set("metal", v)} presets={METAL_PRESETS} />
          <ColorField label="Socle" value={draft.base} onChange={(v) => set("base", v)}
            presets={[{ label: "Noir laqué", color: "#0d0d0f" }, { label: "Blanc", color: "#f2f2f2" }, { label: "Rose", color: "#ff2d87" }, { label: "Bleu nuit", color: "#14213d" }, { label: "Marbre gris", color: "#6b6b70" }]} />
          <ColorField label={kind === "most_wins" ? "Pierre de la coupe" : "Diamants"} value={draft.gem} onChange={(v) => set("gem", v)}
            presets={[{ label: "Diamant", color: "#ffffff" }, { label: "Rose", color: "#ff2d87" }, { label: "Saphir", color: "#2f6bff" }, { label: "Émeraude", color: "#1fbf6a" }, { label: "Rubis", color: "#d01530" }, { label: "Améthyste", color: "#9b4dff" }]} />
          {kind === "rarest_card" && (
            <ColorField label="Couleur de la carte" value={draft.accent} onChange={(v) => set("accent", v)}
              presets={[{ label: "Rose", color: "#ff2d87" }, { label: "Or", color: "#f4c542" }, { label: "Bleu", color: "#2f6bff" }, { label: "Violet", color: "#9b4dff" }, { label: "Noir", color: "#1a1a1f" }]} />
          )}
          <div className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Finition du métal</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FINISH_LABEL) as TrophyFinish[]).map((f) => (
                <button key={f} type="button" onClick={() => set("finish", f)}
                  className={`rounded-full px-3 py-1 text-sm font-bold ${draft.finish === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {FINISH_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={draft.diamonds} onChange={(e) => set("diamonds", e.target.checked)} className="h-4 w-4 accent-primary" />
            Stalactites en diamant autour du socle
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={save} disabled={busy || !dirty || !!err} className="rounded-lg bg-gold px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">Enregistrer</button>
            <button onClick={() => setDraft(saved)} disabled={busy || !dirty} className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold disabled:opacity-50">Annuler les changements</button>
            <button onClick={reset} disabled={busy || !custom} className="rounded-lg px-4 py-2 text-sm font-bold text-destructive disabled:opacity-40">Revenir à l'original</button>
          </div>
        </div>
      </div>
    </div>
  );
}

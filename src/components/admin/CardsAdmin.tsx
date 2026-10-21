import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Pencil, Replace, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import type { Tables } from "@/integrations/supabase/types";
import { rarityMeta, useRarities } from "@/lib/rarity";
import { CARD_PHOTO_BUCKET, cardPhotoUrl, fitWithin, rarityEffects } from "@/lib/card-photo";
import { PlayerCard } from "@/components/PlayerCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Card = Tables<"cards">;
type Stats = Record<string, { owners: number; copies: number }>;

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const PAGE = 60;

type Form = {
  name: string; club: string; nationality: string; pos: string; rating: number; rarity: string;
  image_url: string; alt_image_url: string; has_alt: boolean; has_shiny: boolean; active: boolean;
};
const EMPTY: Form = { name: "", club: "", nationality: "", pos: "", rating: 75, rarity: "common", image_url: "", alt_image_url: "", has_alt: false, has_shiny: false, active: true };
const toForm = (c: Card): Form => ({
  name: c.name, club: c.club, nationality: c.nationality, pos: c.pos, rating: c.rating, rarity: c.rarity,
  image_url: c.image_url ?? "", alt_image_url: c.alt_image_url ?? "", has_alt: c.has_alt, has_shiny: c.has_shiny, active: c.active,
});
const toRow = (f: Form) => ({
  ...f, name: f.name.trim(), club: f.club.trim(), nationality: f.nationality.trim(), pos: f.pos.trim(),
  rating: Math.min(99, Math.max(1, Math.round(Number(f.rating) || 1))),
  image_url: f.image_url.trim() || null, alt_image_url: f.alt_image_url.trim() || null,
});

const ownersLabel = (s?: { owners: number; copies: number }) =>
  !s || s.copies === 0 ? "Aucun joueur ne la possède." : `${s.owners} joueur${s.owners > 1 ? "s" : ""} la possède${s.owners > 1 ? "nt" : ""} (${s.copies} exemplaire${s.copies > 1 ? "s" : ""}).`;

export function CardsAdmin() {
  const rarities = useRarities();
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => fetchAll((from, to) => supabase.from("cards").select("*").order("rating", { ascending: false }).order("name").order("id").range(from, to)),
  });
  const { data: stats = {} } = useQuery({
    queryKey: ["admin-card-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_card_stats");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.card_id, { owners: Number(r.owners), copies: Number(r.copies) }])) as Stats;
    },
  });

  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [replacing, setReplacing] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cards.filter((c) => (!rarity || c.rarity === rarity) && (!s || `${c.name} ${c.club} ${c.nationality}`.toLowerCase().includes(s)));
  }, [cards, q, rarity]);

  const refresh = () => qc.invalidateQueries();

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("cards").update({ active }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }

  async function remove(c: Card) {
    const { error } = await supabase.from("cards").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.name} supprimée`);
    setDeleting(null);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <input className={`${inp} min-w-48 flex-1`} placeholder="Rechercher un joueur, un club, un pays…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        <select className={inp} value={rarity} onChange={(e) => { setRarity(e.target.value); setLimit(PAGE); }}>
          <option value="">Toutes les raretés</option>
          {rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{filtered.length} carte{filtered.length > 1 ? "s" : ""}</span>
        <button onClick={() => setEditing("new")} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-primary-foreground">+ Nouvelle carte</button>
      </div>

      <div className="panel overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2"></th><th>Nom</th><th>Club</th><th>Note</th><th>Rareté</th><th>Versions</th><th>Joueurs</th><th>Active</th><th className="text-right pr-2">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2">
                  {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="h-10 w-7 rounded object-cover" /> : <div className="h-10 w-7 rounded bg-secondary" />}
                </td>
                <td className="font-semibold">{c.name}</td>
                <td>{c.club}</td>
                <td>{c.rating}</td>
                <td>{rarityMeta(c.rarity).label}{c.rarity === "secret_ultimate" && !c.revealed ? " (cachée)" : ""}</td>
                <td>{[c.has_alt && "ALT", c.has_shiny && "Shiny"].filter(Boolean).join(", ") || "—"}</td>
                <td>{stats[c.id]?.owners ?? 0}</td>
                <td><input type="checkbox" aria-label={`Activer ${c.name}`} checked={c.active} onChange={(e) => toggle(c.id, e.target.checked)} /></td>
                <td className="pr-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(c)} className="rounded-md p-1.5 hover:bg-secondary" title="Modifier" aria-label={`Modifier ${c.name}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setReplacing(c)} className="rounded-md p-1.5 hover:bg-secondary" title="Remplacer" aria-label={`Remplacer ${c.name}`}><Replace className="h-4 w-4" /></button>
                    <button onClick={() => setDeleting(c)} className="rounded-md p-1.5 text-destructive hover:bg-secondary" title="Supprimer" aria-label={`Supprimer ${c.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > limit && (
          <button onClick={() => setLimit(limit + PAGE)} className="mt-2 w-full rounded-lg bg-secondary py-2 text-sm font-bold">
            Voir plus ({filtered.length - limit} restantes)
          </button>
        )}
      </div>

      {editing && <EditDialog card={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {replacing && <ReplaceDialog card={replacing} cards={cards} stats={stats} onClose={() => setReplacing(null)} onDone={refresh} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleting?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {ownersLabel(deleting ? stats[deleting.id] : undefined)}{" "}
              {deleting && (stats[deleting.id]?.copies ?? 0) > 0
                ? "Ils la perdront définitivement de leur collection. Pour la retirer des packs sans la leur enlever, décoche plutôt « Active », ou utilise « Remplacer »."
                : "Elle sera retirée du jeu définitivement."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && remove(deleting)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({ card, onClose, onSaved }: { card: Card | null; onClose: () => void; onSaved: () => void }) {
  const rarities = useRarities();
  const [f, setF] = useState<Form>(card ? toForm(card) : EMPTY);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row = toRow(f);
    const { error } = card ? await supabase.from("cards").update(row).eq("id", card.id) : await supabase.from("cards").insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(card ? "Carte modifiée" : "Carte ajoutée");
    onSaved();
    onClose();
  }

  const preview = { ...toRow(f), ...(card ? { id: card.id } : {}) };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? `Modifier ${card.name}` : "Nouvelle carte"}</DialogTitle>
          <DialogDescription>Les joueurs qui possèdent déjà cette carte verront directement les changements.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Nom<input className={`${inp} w-full`} required value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Club<input className={`${inp} w-full`} required value={f.club} onChange={(e) => set("club", e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Nationalité<input className={`${inp} w-full`} required value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Poste (ex : BU)<input className={`${inp} w-full`} required value={f.pos} onChange={(e) => set("pos", e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Note (1-99)<input className={`${inp} w-full`} type="number" min={1} max={99} value={f.rating} onChange={(e) => set("rating", +e.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Rareté
              <select className={`${inp} w-full`} value={f.rarity} onChange={(e) => set("rarity", e.target.value)}>
                {rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <PhotoField label="Photo du joueur" value={f.image_url} onChange={(v) => set("image_url", v)} />
            {(f.rarity === "legendary" || f.has_alt) && (
              <PhotoField label="Photo ALT (une autre photo du joueur)" value={f.alt_image_url} onChange={(v) => set("alt_image_url", v)} />
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-2">
              {(f.rarity === "legendary" || f.has_alt) && (
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.has_alt} onChange={(e) => set("has_alt", e.target.checked)} /> Version ALT</label>
              )}
              {(f.rarity === "secret_legendary" || f.has_shiny) && (
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.has_shiny} onChange={(e) => set("has_shiny", e.target.checked)} /> Version Shiny (même photo)</label>
              )}
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active (peut sortir des packs)</label>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 text-xs sm:col-span-2">
              <p className="mb-1.5 font-bold text-foreground">Effets appliqués automatiquement ({rarityMeta(f.rarity).label})</p>
              <EffectList items={rarityEffects(f.rarity)} />
              {f.has_alt && <><p className="mb-1.5 mt-2 font-bold text-foreground">Version ALT</p><EffectList items={rarityEffects(f.rarity, "alt")} /></>}
              {f.has_shiny && <><p className="mb-1.5 mt-2 font-bold text-foreground">Version Shiny</p><EffectList items={rarityEffects(f.rarity, "shiny")} /></>}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:flex-col sm:flex-nowrap">
            <div className="w-36">
              <p className="mb-1 text-center text-xs text-muted-foreground">Aperçu</p>
              <PlayerCard card={preview} />
            </div>
            {f.has_alt && (
              <div className="w-36">
                <p className="mb-1 text-center text-xs text-muted-foreground">Aperçu ALT</p>
                <PlayerCard card={{ ...preview, version: "alt" }} />
              </div>
            )}
            {f.has_shiny && (
              <div className="w-36">
                <p className="mb-1 text-center text-xs text-muted-foreground">Aperçu Shiny</p>
                <PlayerCard card={{ ...preview, version: "shiny" }} />
              </div>
            )}
          </div>
          <DialogFooter className="sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold">Annuler</button>
            <button disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {card ? "Enregistrer" : "Ajouter la carte"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceDialog({ card, cards, stats, onClose, onDone }: { card: Card; cards: Card[]; stats: Stats; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cards.filter((c) => c.id !== card.id && (!s || `${c.name} ${c.club}`.toLowerCase().includes(s))).slice(0, 40);
  }, [cards, card.id, q]);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_replace_card", { _from: card.id, _to: target.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${card.name} remplacée par ${target.name} (${data ?? 0} exemplaire${(data ?? 0) > 1 ? "s" : ""} transféré${(data ?? 0) > 1 ? "s" : ""})`);
    onDone();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remplacer {card.name}</DialogTitle>
          <DialogDescription>
            {ownersLabel(stats[card.id])} Tous les exemplaires passent sur la carte choisie, puis {card.name} est supprimée.
            Pratique pour fusionner un doublon. Pour juste changer la photo ou les infos, utilise plutôt « Modifier ».
          </DialogDescription>
        </DialogHeader>
        <input className={`${inp} w-full`} placeholder="Chercher la carte de remplacement…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTarget(c)}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-secondary ${target?.id === c.id ? "bg-secondary ring-1 ring-primary" : ""}`}
            >
              {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="h-10 w-7 rounded object-cover" /> : <div className="h-10 w-7 rounded bg-background" />}
              <span className="font-semibold">{c.name}</span>
              <span className="text-muted-foreground">{c.club} · {c.rating} · {rarityMeta(c.rarity).label}</span>
            </button>
          ))}
          {options.length === 0 && <p className="p-2 text-sm text-muted-foreground">Aucune carte trouvée.</p>}
        </div>
        {target && (
          <p className="text-sm text-muted-foreground">
            Les ALT / Shiny redeviennent des versions normales si {target.name} n'a pas cette version.
          </p>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold">Annuler</button>
          <button onClick={confirm} disabled={!target || busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {target ? `Remplacer par ${target.name}` : "Choisis une carte"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EffectList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => <li key={t} className="rounded-full bg-secondary px-2 py-0.5 text-foreground">{t}</li>)}
    </ul>
  );
}

/** Shrinks the picked photo in the browser, then stores it in the private card-photos bucket. */
async function uploadCardPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image.");
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) throw new Error("Impossible de lire cette image.");
  const name = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(CARD_PHOTO_BUCKET).upload(name, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return cardPhotoUrl(name);
}

export function PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadCardPhoto(file));
      toast.success("Photo importée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="text-xs text-muted-foreground sm:col-span-2">
      <span>{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />} Photo depuis ce PC
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" aria-label={`${label} : fichier`} onChange={(e) => pick(e.target.files?.[0])} />
        <input className={`${inp} min-w-48 flex-1`} placeholder="ou colle un lien https://…/photo.jpg" aria-label={`${label} : lien`} value={value} onChange={(e) => onChange(e.target.value)} />
        {value && (
          <button type="button" onClick={() => onChange("")} className="rounded-lg p-2 hover:bg-secondary" aria-label="Retirer la photo" title="Retirer la photo"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

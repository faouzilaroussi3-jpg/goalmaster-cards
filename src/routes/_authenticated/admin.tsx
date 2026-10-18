import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { RARITIES } from "@/lib/rarity";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Goalmaster" },
      { name: "description", content: "Gérer les cartes, packs, taux de drop et événements." },
      { property: "og:title", content: "Administration — Goalmaster" },
      { property: "og:description", content: "Interface administrateur Goalmaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";

function AdminPage() {
  const { data: profile, isLoading } = useProfile();
  const [tab, setTab] = useState<"cards" | "packs" | "events">("cards");
  if (isLoading) return null;
  if (!profile?.isAdmin) return <p className="p-8 text-center text-muted-foreground">Accès réservé aux administrateurs.</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl text-gold">Administration</h1>
      <div className="my-4 flex gap-2">
        {(["cards", "packs", "events"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {t === "cards" ? "Cartes" : t === "packs" ? "Packs & taux" : "Événements"}
          </button>
        ))}
      </div>
      {tab === "cards" && <CardsAdmin />}
      {tab === "packs" && <PacksAdmin />}
      {tab === "events" && <EventsAdmin />}
    </div>
  );
}

function CardsAdmin() {
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: async () => (await supabase.from("cards").select("*").order("rating", { ascending: false })).data ?? [],
  });
  const empty = { name: "", club: "", nationality: "", pos: "", rating: 75, rarity: "common", image_url: "", has_alt: false, has_shiny: false };
  const [f, setF] = useState(empty);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("cards").insert({ ...f, image_url: f.image_url || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Carte ajoutée");
    setF(empty);
    qc.invalidateQueries();
  }
  async function toggle(id: string, active: boolean) {
    await supabase.from("cards").update({ active }).eq("id", id);
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="panel grid gap-2 p-4 sm:grid-cols-4">
        <input className={inp} placeholder="Nom" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="Club" required value={f.club} onChange={(e) => setF({ ...f, club: e.target.value })} />
        <input className={inp} placeholder="Nationalité" required value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} />
        <input className={inp} placeholder="Poste (ex: BU)" required value={f.pos} onChange={(e) => setF({ ...f, pos: e.target.value })} />
        <input className={inp} type="number" min={1} max={99} value={f.rating} onChange={(e) => setF({ ...f, rating: +e.target.value })} />
        <select className={inp} value={f.rarity} onChange={(e) => setF({ ...f, rarity: e.target.value })}>
          {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <input className={inp} placeholder="URL illustration (optionnel)" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
        <div className="flex items-center gap-3 text-sm">
          <label><input type="checkbox" checked={f.has_alt} onChange={(e) => setF({ ...f, has_alt: e.target.checked })} /> ALT</label>
          <label><input type="checkbox" checked={f.has_shiny} onChange={(e) => setF({ ...f, has_shiny: e.target.checked })} /> Shiny</label>
        </div>
        <button className="rounded-lg bg-gold py-2 font-bold text-primary-foreground sm:col-span-4">Ajouter la carte</button>
      </form>
      <div className="panel overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">Nom</th><th>Club</th><th>Note</th><th>Rareté</th><th>Versions</th><th>Active</th></tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-semibold">{c.name}</td>
                <td>{c.club}</td>
                <td>{c.rating}</td>
                <td>{RARITIES.find((r) => r.key === c.rarity)?.label}{c.rarity === "secret_ultimate" && !c.revealed ? " (cachée)" : ""}</td>
                <td>{[c.has_alt && "ALT", c.has_shiny && "Shiny"].filter(Boolean).join(", ") || "—"}</td>
                <td><input type="checkbox" checked={c.active} onChange={(e) => toggle(c.id, e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PacksAdmin() {
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery({
    queryKey: ["admin-packs"],
    queryFn: async () => (await supabase.from("pack_types").select("*").order("sort_order")).data ?? [],
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {packs.map((p) => <PackEditor key={p.id} p={p} onSaved={() => qc.invalidateQueries()} />)}
    </div>
  );
}

type Pack = { id: string; name: string; slot_rates: unknown; bonus_rates: unknown; regen_minutes: number; max_stock: number; price_coins: number; xp_reward: number; active: boolean };

function PackEditor({ p, onSaved }: { p: Pack; onSaved: () => void }) {
  const [slot, setSlot] = useState<Record<string, number>>(p.slot_rates as Record<string, number>);
  const [bonus, setBonus] = useState<Record<string, number>>(p.bonus_rates as Record<string, number>);
  const [cfg, setCfg] = useState({ regen_minutes: p.regen_minutes, max_stock: p.max_stock, price_coins: p.price_coins, xp_reward: p.xp_reward, active: p.active });
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);

  async function save() {
    const clean = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    const { error } = await supabase.from("pack_types").update({ ...cfg, slot_rates: clean(slot), bonus_rates: clean(bonus) }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pack enregistré");
    onSaved();
  }

  return (
    <div className="panel space-y-3 p-4">
      <h3 className="text-2xl">{p.name}</h3>
      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Taux par carte (total {sum(slot).toFixed(1)}%)</p>
        {RARITIES.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-2 py-0.5 text-sm">
            {r.label}
            <input className={`${inp} w-24`} type="number" step="0.1" min={0} value={slot[r.key] ?? 0} onChange={(e) => setSlot({ ...slot, [r.key]: +e.target.value })} />
          </label>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Carte bonus (total {sum(bonus).toFixed(1)}%)</p>
        {([["normal", "Normale"], ["alt", "ALT"], ["shiny", "Shiny"], ["ultimate", "Secrète Ultime"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 py-0.5 text-sm">
            {l}
            <input className={`${inp} w-24`} type="number" step="0.1" min={0} value={bonus[k] ?? 0} onChange={(e) => setBonus({ ...bonus, [k]: +e.target.value })} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <label>Recharge (min, 0 = aucune)<input className={`${inp} w-full`} type="number" value={cfg.regen_minutes} onChange={(e) => setCfg({ ...cfg, regen_minutes: +e.target.value })} /></label>
        <label>Stock max<input className={`${inp} w-full`} type="number" value={cfg.max_stock} onChange={(e) => setCfg({ ...cfg, max_stock: +e.target.value })} /></label>
        <label>Prix en pièces (0 = non achetable)<input className={`${inp} w-full`} type="number" value={cfg.price_coins} onChange={(e) => setCfg({ ...cfg, price_coins: +e.target.value })} /></label>
        <label>XP par ouverture<input className={`${inp} w-full`} type="number" value={cfg.xp_reward} onChange={(e) => setCfg({ ...cfg, xp_reward: +e.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> Pack actif</label>
      <button onClick={save} className="w-full rounded-lg bg-gold py-2 font-bold text-primary-foreground">Enregistrer</button>
    </div>
  );
}

function EventsAdmin() {
  const qc = useQueryClient();
  const { data: events = [] } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => (await supabase.from("events").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const [f, setF] = useState({ title: "", description: "", pack_key: "", ends_at: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("events").insert({
      title: f.title, description: f.description, pack_key: f.pack_key || null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    setF({ title: "", description: "", pack_key: "", ends_at: "" });
    qc.invalidateQueries();
  }
  async function del(id: string) {
    await supabase.from("events").delete().eq("id", id);
    qc.invalidateQueries();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="panel grid gap-2 p-4 sm:grid-cols-2">
        <input className={inp} placeholder="Titre" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className={inp} value={f.pack_key} onChange={(e) => setF({ ...f, pack_key: e.target.value })}>
          <option value="">Aucun pack lié</option>
          <option value="classic">Classique</option>
          <option value="premium">Premium</option>
        </select>
        <textarea className={`${inp} sm:col-span-2`} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={inp} type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        <button className="rounded-lg bg-gold py-2 font-bold text-primary-foreground">Créer l'événement</button>
      </form>
      {events.map((e) => (
        <div key={e.id} className="panel flex items-center justify-between p-3">
          <div><b>{e.title}</b> <span className="text-sm text-muted-foreground">{e.description}</span></div>
          <button onClick={() => del(e.id)} className="text-sm text-destructive">Supprimer</button>
        </div>
      ))}
    </div>
  );
}

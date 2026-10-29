import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { CardsAdmin } from "@/components/admin/CardsAdmin";
import { GiftsAdmin } from "@/components/admin/GiftsAdmin";
import { RaritiesAdmin } from "@/components/admin/RaritiesAdmin";
import { PacksAdmin } from "@/components/admin/PacksAdmin";
import { ChallengesAdmin } from "@/components/admin/ChallengesAdmin";
import { BallonDorAdmin } from "@/components/admin/BallonDorAdmin";
import { StatsAdmin } from "@/components/admin/StatsAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Goalmaster" },
      { name: "description", content: "Statistiques et classements des joueurs, gérer les cartes, raretés, packs, défis, taux de drop et événements." },
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
  const [tab, setTab] = useState<"stats" | "cards" | "rarities" | "gifts" | "packs" | "challenges" | "ballon" | "events">("cards");
  if (isLoading) return null;
  if (!profile?.isAdmin) return <p className="p-8 text-center text-muted-foreground">Accès réservé aux administrateurs.</p>;
  const label = { stats: "Statistiques joueurs", cards: "Cartes", rarities: "Raretés", gifts: "Cadeaux joueurs", packs: "Packs", challenges: "Défis", ballon: "Ballon d'Or", events: "Événements" } as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl text-gold">Administration</h1>
      <div className="my-4 flex flex-wrap gap-2">
        {(["stats", "cards", "rarities", "gifts", "packs", "challenges", "ballon", "events"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {label[t]}
          </button>
        ))}
      </div>
      {tab === "stats" && <StatsAdmin />}
      {tab === "cards" && <CardsAdmin />}
      {tab === "rarities" && <RaritiesAdmin />}
      {tab === "gifts" && <GiftsAdmin />}
      {tab === "packs" && <PacksAdmin />}
      {tab === "challenges" && <ChallengesAdmin />}
      {tab === "ballon" && <BallonDorAdmin />}
      {tab === "events" && <EventsAdmin />}
    </div>
  );
}

function EventsAdmin() {
  const qc = useQueryClient();
  const { data: events = [] } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => (await supabase.from("events").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: packs = [] } = useQuery({
    queryKey: ["admin-gift-packs"],
    queryFn: async () => (await supabase.from("pack_types").select("key, name").eq("archived", false).order("sort_order")).data ?? [],
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
          {packs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
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

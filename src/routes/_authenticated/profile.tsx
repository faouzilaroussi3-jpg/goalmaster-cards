import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Mon profil — Goalmaster" },
      { name: "description", content: "Votre niveau, vos statistiques et votre historique d'ouverture." },
      { property: "og:title", content: "Mon profil — Goalmaster" },
      { property: "og:description", content: "Profil joueur Goalmaster." },
    ],
  }),
  component: ProfilePage,
});

interface R { name: string; rarity: string; version: string; is_bonus: boolean }

function ProfilePage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => { if (profile) setName(profile.username); }, [profile]);

  const { data: history = [] } = useQuery({
    queryKey: ["history", uid],
    queryFn: async () =>
      (await supabase.from("pack_openings").select("id, created_at, results, pack_types(name)").eq("user_id", uid).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: stats } = useQuery({
    queryKey: ["my-stats", uid],
    queryFn: async () => {
      const [{ count: openings }, { data: cards }] = await Promise.all([
        supabase.from("pack_openings").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("user_cards").select("version, cards(rarity)").eq("user_id", uid),
      ]);
      const c = cards ?? [];
      return {
        openings: openings ?? 0,
        total: c.length,
        legend: c.filter((x) => ["legendary", "secret_legendary"].includes(x.cards?.rarity ?? "")).length,
        shiny: c.filter((x) => x.version === "shiny").length,
        su: c.filter((x) => x.cards?.rarity === "secret_ultimate").length,
      };
    },
  });

  async function save() {
    const { error } = await supabase.from("profiles").update({ username: name.trim().slice(0, 24) }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const xpInLevel = (profile?.xp ?? 0) % 100;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="panel p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label className="text-xs uppercase text-muted-foreground">Pseudo</label>
            <div className="mt-1 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-foreground" />
              <button onClick={save} className="rounded-lg bg-gold px-4 font-bold text-primary-foreground">OK</button>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl text-gold">Niv. {profile?.level}</div>
            <div className="text-sm text-muted-foreground">{profile?.coins} pièces</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gold" style={{ width: `${xpInLevel}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{xpInLevel}/100 XP vers le niveau suivant</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["Packs ouverts", stats?.openings], ["Cartes", stats?.total], ["Légendaires", stats?.legend], ["Shiny", stats?.shiny], ["Secrètes Ultimes", stats?.su]].map(([l, v]) => (
          <div key={l as string} className="panel p-3">
            <div className="font-display text-3xl text-gold">{v ?? 0}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-3xl">Historique d'ouverture</h2>
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="panel p-3">
            <div className="flex justify-between text-sm">
              <span className="font-bold">{h.pack_types?.name}</span>
              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {((h.results as unknown as R[]) ?? []).map((r, i) => (
                <span key={i} className={`rounded px-2 py-0.5 text-xs ${r.is_bonus ? "bg-gold text-primary-foreground" : "bg-secondary"}`}>
                  {r.name} · {rarityMeta(r.rarity).short}{r.version !== "normal" ? ` ${VERSION_LABEL[r.version]}` : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!history.length && <p className="text-muted-foreground">Aucun pack ouvert pour l'instant.</p>}
      </div>
    </div>
  );
}

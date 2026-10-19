import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { rarityMeta, useRarities } from "@/lib/rarity";
import { PlayerCard } from "@/components/PlayerCard";
import { PhotoCredits } from "@/components/PhotoCredits";
import { CardViewer } from "@/components/CardViewer";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({
    meta: [
      { title: "Ma collection — Goalmaster" },
      { name: "description", content: "Toutes vos cartes, les cartes manquantes et vos statistiques de collection." },
      { property: "og:title", content: "Ma collection — Goalmaster" },
      { property: "og:description", content: "Votre collection de cartes de football." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const rarities = useRarities();
  const { session } = useAuth();
  const uid = session!.user.id;
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await supabase.from("cards").select("*").eq("active", true)).data ?? [],
  });
  const { data: owned = [] } = useQuery({
    queryKey: ["my-cards", uid],
    queryFn: async () => (await supabase.from("user_cards").select("card_id, version").eq("user_id", uid)).data ?? [],
  });

  const [view, setView] = useState<"owned" | "missing" | "all">("owned");
  const [q, setQ] = useState("");
  const [club, setClub] = useState("");
  const [country, setCountry] = useState("");
  const [rarity, setRarity] = useState("");
  const [version, setVersion] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [viewing, setViewing] = useState<{ card: (typeof catalog)[number]; version: string; count: number } | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of owned) m.set(`${o.card_id}:${o.version}`, (m.get(`${o.card_id}:${o.version}`) ?? 0) + 1);
    return m;
  }, [owned]);

  // Build entries: one per card per version available
  const entries = useMemo(() => {
    const list: { card: (typeof catalog)[number]; version: string; count: number }[] = [];
    for (const c of catalog) {
      const versions = ["normal", ...(c.has_alt ? ["alt"] : []), ...(c.has_shiny ? ["shiny"] : [])];
      for (const v of versions) list.push({ card: c, version: v, count: counts.get(`${c.id}:${v}`) ?? 0 });
    }
    return list;
  }, [catalog, counts]);

  const filtered = entries
    .filter((e) => (view === "owned" ? e.count > 0 : view === "missing" ? e.count === 0 : true))
    .filter((e) => !q || e.card.name.toLowerCase().includes(q.toLowerCase()))
    .filter((e) => !club || e.card.club === club)
    .filter((e) => !country || e.card.nationality === country)
    .filter((e) => !rarity || e.card.rarity === rarity)
    .filter((e) => !version || e.version === version)
    .sort((a, b) => {
      const d = rarityMeta(a.card.rarity).rank - rarityMeta(b.card.rarity).rank || a.card.rating - b.card.rating;
      return sortDesc ? -d : d;
    });

  const clubs = [...new Set(catalog.map((c) => c.club))].sort();
  const countries = [...new Set(catalog.map((c) => c.nationality))].sort();
  const uniqueOwned = entries.filter((e) => e.count > 0).length;
  // Secret Ultimate cards only come back for their owners (and the admin), so the tier stays invisible until pulled.
  const hasUltimate = catalog.some((c) => c.rarity === "secret_ultimate");
  const visibleRarities = rarities.filter((r) => r.key !== "secret_ultimate" || hasUltimate);
  const sel = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-5xl text-gold">Ma collection</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Cartes possédées" value={owned.length} />
        <Stat label="Uniques" value={`${uniqueOwned}/${entries.length}`} />
        <Stat label="Complétion" value={`${entries.length ? Math.round((uniqueOwned / entries.length) * 100) : 0}%`} />
        {visibleRarities.slice(2).map((r) => (
          <Stat key={r.key} label={r.label} value={owned.filter((o) => catalog.find((c) => c.id === o.card_id)?.rarity === r.key).length} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["owned", "missing", "all"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${view === v ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {v === "owned" ? "Obtenues" : v === "missing" ? "Manquantes" : "Toutes"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={sel} placeholder="Joueur…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={sel} value={club} onChange={(e) => setClub(e.target.value)}>
          <option value="">Tous les clubs</option>
          {clubs.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={sel} value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Tous les pays</option>
          {countries.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={sel} value={rarity} onChange={(e) => setRarity(e.target.value)}>
          <option value="">Toutes raretés</option>
          {visibleRarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className={sel} value={version} onChange={(e) => setVersion(e.target.value)}>
          <option value="">Toutes versions</option>
          <option value="normal">Normale</option>
          <option value="alt">ALT</option>
          <option value="shiny">Shiny</option>
        </select>
        <button className={sel} onClick={() => setSortDesc(!sortDesc)}>
          Rareté {sortDesc ? "↓" : "↑"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {filtered.map((e) => (
          <button key={`${e.card.id}:${e.version}`} type="button" data-sfx="card" onClick={() => setViewing(e)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Voir ${e.card.name} en grand`}>
            <PlayerCard card={{ ...e.card, version: e.version }} missing={e.count === 0} count={e.count} />
          </button>
        ))}
      </div>
      {!filtered.length && <p className="mt-6 text-muted-foreground">Aucune carte ne correspond.</p>}
      <PhotoCredits cards={catalog} />
      <CardViewer card={viewing ? { ...viewing.card, version: viewing.version } : null} missing={viewing?.count === 0} count={viewing?.count} onClose={() => setViewing(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-3">
      <div className="font-display text-3xl text-gold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

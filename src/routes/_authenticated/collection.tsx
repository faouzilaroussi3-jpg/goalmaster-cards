import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useAuth, useProfile } from "@/lib/auth";
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
  const { data: profile } = useProfile();
  // Admins can see missing cards in full colour (players keep the greyed-out look).
  const [adminColors, setAdminColors] = useState(true);
  const showMissingColors = !!profile?.isAdmin && adminColors;
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => fetchAll((from, to) => supabase.from("cards").select("*").eq("active", true).order("id").range(from, to)),
  });
  const { data: owned = [] } = useQuery({
    queryKey: ["my-cards", uid],
    queryFn: () => fetchAll((from, to) => supabase.from("user_cards").select("card_id, version").eq("user_id", uid).order("id").range(from, to)),
  });

  const [view, setView] = useState<"owned" | "missing" | "all">("owned");
  const [q, setQ] = useState("");
  const [club, setClub] = useState("");
  const [country, setCountry] = useState("");
  const [rarity, setRarity] = useState("");
  const [version, setVersion] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  // 3 000+ cards: show them in batches so the page stays smooth.
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [view, q, club, country, rarity, version, sortDesc]);
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
      const off = !rarityMeta(c.rarity).active;
      for (const v of versions) {
        const count = counts.get(`${c.id}:${v}`) ?? 0;
        // Switched-off rarities: players only keep seeing the cards they own; the admin still sees them all.
        if (off && !count && !profile?.isAdmin) continue;
        list.push({ card: c, version: v, count });
      }
    }
    return list;
  }, [catalog, counts, rarities, profile?.isAdmin]);

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
  const rarityById = useMemo(() => new Map(catalog.map((c) => [c.id, c.rarity])), [catalog]);
  // Secret Ultimate cards only come back for their owners (and the admin), so the tier stays invisible until pulled.
  const hasUltimate = catalog.some((c) => c.rarity === "secret_ultimate");
  const visibleRarities = rarities.filter((r) => (r.key !== "secret_ultimate" || hasUltimate) && (r.active || profile?.isAdmin || entries.some((e) => e.card.rarity === r.key)));
  const sel = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-5xl text-gold">Ma collection</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Cartes possédées" value={owned.length} />
        <Stat label="Uniques" value={`${uniqueOwned}/${entries.length}`} />
        <Stat label="Complétion" value={`${entries.length ? Math.round((uniqueOwned / entries.length) * 100) : 0}%`} />
        {visibleRarities.slice(2).map((r) => (
          <Stat key={r.key} label={r.label} value={owned.filter((o) => rarityById.get(o.card_id) === r.key).length} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["owned", "missing", "all"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${view === v ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {v === "owned" ? "Obtenues" : v === "missing" ? "Manquantes" : "Toutes"}
          </button>
        ))}
        {profile?.isAdmin && (
          <button type="button" onClick={() => setAdminColors(!adminColors)} aria-pressed={adminColors} className={`ml-auto rounded-full border px-4 py-1.5 text-sm font-bold ${adminColors ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>
            Admin · Manquantes en couleur : {adminColors ? "oui" : "non"}
          </button>
        )}
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
        {filtered.slice(0, limit).map((e) => (
          <button key={`${e.card.id}:${e.version}`} type="button" data-sfx="card" onClick={() => setViewing(e)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Voir ${e.card.name} en grand`}>
            <span className="relative block">
              <PlayerCard card={{ ...e.card, version: e.version }} missing={e.count === 0 && !showMissingColors} count={e.count} />
              {e.count === 0 && showMissingColors && (
                <span className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 translate-y-1/2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manquante</span>
              )}
            </span>
          </button>
        ))}
      </div>
      {filtered.length > limit && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setLimit(limit + 60)} className="rounded-full bg-secondary px-6 py-2 text-sm font-bold text-foreground hover:bg-secondary/80">
            Voir plus ({filtered.length - limit} restantes)
          </button>
        </div>
      )}
      {!filtered.length && <p className="mt-6 text-muted-foreground">Aucune carte ne correspond.</p>}
      <PhotoCredits cards={catalog} />
      <CardViewer card={viewing ? { ...viewing.card, version: viewing.version } : null} missing={viewing?.count === 0} showColor={showMissingColors} count={viewing?.count} onClose={() => setViewing(null)} />
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

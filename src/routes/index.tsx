import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Package, CalendarDays } from "lucide-react";
import stadium from "@/assets/stadium.jpg";
import packClassic from "@/assets/pack-classic.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyPacks, useProfile } from "@/lib/auth";
import { PlayerCard } from "@/components/PlayerCard";
import { LeaderboardTable } from "@/components/LeaderboardTable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Goalmaster — Collectionnez les légendes du football" },
      { name: "description", content: "Ouvrez des boosters, découvrez des cartes Légendaires, Shiny et Secrètes Ultimes, et grimpez au classement." },
      { property: "og:title", content: "Goalmaster — Collectionnez les légendes du football" },
      { property: "og:description", content: "Le jeu de cartes de football à collectionner. Ouvrez vos packs !" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: packs } = useMyPacks();
  const totalPacks = packs?.reduce((s, p) => s + p.count, 0) ?? 0;

  const { data: drops } = useQuery({
    queryKey: ["recent-drops"],
    queryFn: async () => (await supabase.rpc("get_recent_drops", { _limit: 12 })).data ?? [],
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: async () =>
      (await supabase.from("events").select("*").eq("active", true).order("starts_at", { ascending: false })).data ?? [],
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={stadium} alt="" width={1920} height={832} className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="anim-rise">
            <h1 className="text-6xl leading-none text-gold sm:text-8xl">GOALMASTER</h1>
            <p className="mt-4 max-w-md text-lg text-muted-foreground">
              Ouvrez des boosters, traquez les cartes Secrètes et devenez le plus grand collectionneur.
            </p>
            {session ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="panel flex items-center gap-2 px-4 py-2 font-bold text-primary">
                  <Coins className="h-5 w-5" /> {profile?.coins ?? "…"} pièces
                </span>
                <span className="panel flex items-center gap-2 px-4 py-2 font-bold">
                  <Package className="h-5 w-5 text-primary" /> {totalPacks} packs disponibles
                </span>
              </div>
            ) : null}
            <Link
              to={session ? "/packs" : "/auth"}
              className="mt-6 inline-block rounded-xl bg-gold px-8 py-4 font-display text-2xl tracking-widest text-primary-foreground shadow-gold transition hover:scale-105"
            >
              {session ? "Ouvrir mes packs" : "Commencer à jouer"}
            </Link>
          </div>
          <div className="flex justify-center">
            <img src={packClassic} alt="Pack Goalmaster" width={768} height={1152} className="anim-float w-48 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:w-64" />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-3xl">Dernières cartes obtenues</h2>
          {drops?.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {drops.map((d, i) => (
                <div key={i}>
                  <PlayerCard card={d} />
                  <p className="mt-1 truncate text-center text-xs text-muted-foreground">par {d.username}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel p-6 text-muted-foreground">Aucune carte rare tirée pour l'instant. Soyez le premier !</p>
          )}

          <h2 className="mb-4 mt-10 text-3xl">Événements & packs spéciaux</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {events?.map((e) => (
              <div key={e.id} className="panel p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                  <CalendarDays className="h-4 w-4" />
                  {e.ends_at ? `Jusqu'au ${new Date(e.ends_at).toLocaleDateString("fr-FR")}` : "Permanent"}
                </div>
                <h3 className="mt-2 text-2xl">{e.title}</h3>
                <p className="text-sm text-muted-foreground">{e.description}</p>
                {e.pack_key && (
                  <Link to="/packs" className="mt-3 inline-block text-sm font-bold text-primary hover:underline">
                    Voir le pack →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-3xl">Top collectionneurs</h2>
          <div className="panel p-4">
            <LeaderboardTable limit={10} compact />
          </div>
        </section>
      </div>
    </div>
  );
}

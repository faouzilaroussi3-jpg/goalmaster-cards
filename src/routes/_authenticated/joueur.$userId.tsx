import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lookFromRow, type AvatarRow } from "@/lib/avatar";
import { sideTrophiesOf, trophiesOf } from "@/lib/ballon-dor";
import { useCeremonies, useCeremonyAwards, useTrophyNames } from "@/lib/ballon-dor-query";

const AvatarStage = lazy(() => import("@/components/avatar/AvatarStage"));

export const Route = createFileRoute("/_authenticated/joueur/$userId")({
  head: () => ({
    meta: [
      { title: "Profil joueur — Goalmaster" },
      { name: "description", content: "Avatar 3D et vitrine de trophées d'un joueur Goalmaster." },
      { property: "og:title", content: "Profil joueur — Goalmaster" },
      { property: "og:description", content: "Découvre l'avatar 3D et la vitrine de trophées de ce joueur." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerPage,
});

function PlayerPage() {
  const { userId } = Route.useParams();
  const [back, setBack] = useState(false);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["player-profile", userId],
    queryFn: async () => (await supabase.from("profiles").select("id, username, level").eq("id", userId).maybeSingle()).data,
  });
  const { data: row } = useQuery({
    queryKey: ["avatar", userId],
    queryFn: async () => (await supabase.from("avatars").select("*").eq("user_id", userId).maybeSingle()).data as AvatarRow | null,
  });
  const { data: ceremonies = [] } = useCeremonies();
  const { data: awards = [] } = useCeremonyAwards();
  const names = useTrophyNames();
  const ballons = trophiesOf(ceremonies, userId);
  const sides = sideTrophiesOf(awards, userId);

  if (!isLoading && !profile) return <p className="p-8 text-center text-muted-foreground">Joueur introuvable.</p>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-5xl text-gold">{profile?.username ?? "…"}</h1>
      <p className="text-sm text-muted-foreground">Niveau {profile?.level ?? "–"}</p>
      <div className="panel relative mt-4 h-[58vh] min-h-[380px] overflow-hidden p-0">
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Chargement du vestiaire…</div>}>
          <AvatarStage look={lookFromRow(row)} trophies={ballons.length} others={sides.map((a) => a.kind)} back={back} />
        </Suspense>
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <button onClick={() => setBack((b) => !b)} className="rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-foreground">
            {back ? "Voir de face" : "Voir le dos"}
          </button>
        </div>
      </div>
      <div className="panel mt-4 p-4">
        <h2 className="flex items-center gap-2 text-3xl"><Trophy className="h-6 w-6 text-primary" /> Vitrine</h2>
        {!ballons.length && !sides.length ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun trophée détenu cette semaine.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {ballons.map((c) => <li key={c.id} className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">{names.ballon} · {c.title}</li>)}
            {sides.map((a) => <li key={a.id} className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-foreground">{names[a.kind]} · {a.detail}</li>)}
          </ul>
        )}
      </div>
      <Link to="/ballon-dor" className="mt-4 inline-block text-sm font-bold text-primary">Voir le palmarès du Ballon d'Or →</Link>
    </div>
  );
}

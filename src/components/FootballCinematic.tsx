import { lazy, Suspense } from "react";
import { openingCinematic } from "@/lib/opening-cinematic";
const FootballCanvas = lazy(() => import("./football-3d/FootballCanvas"));

export function FootballCinematic({ cards, onComplete }: { cards: ReadonlyArray<{ tier: number }>; onComplete: () => void }) {
  const { tier, action } = openingCinematic(cards);
  return <div className="football-cinematic" data-tier={tier} data-action={action} role="img" aria-label="Footballeur 3D en action">
    <Suspense fallback={<span className="font-display text-xl text-primary">Préparation…</span>}><FootballCanvas tier={tier} onComplete={onComplete} /></Suspense>
  </div>;
}
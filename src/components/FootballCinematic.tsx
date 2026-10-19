import { lazy, Suspense } from "react";
import { openingCinematic } from "@/lib/opening-cinematic";
const loadCanvas = () => import("./football-3d/FootballCanvas");
const FootballCanvas = lazy(loadCanvas);

/** Fetch the 3D scene code and athlete model ahead of time so the cinematic starts instantly. */
export function preloadFootballCinematic() {
  void loadCanvas().then((m) => m.preloadAthlete()).catch(() => undefined);
}

export function FootballCinematic({ cards, onComplete }: { cards: ReadonlyArray<{ tier: number }>; onComplete: () => void }) {
  const { tier, action } = openingCinematic(cards);
  return <div className="football-cinematic" data-tier={tier} data-action={action} role="img" aria-label="Footballeur 3D en action">
    <Suspense fallback={null}><FootballCanvas tier={tier} onComplete={onComplete} /></Suspense>
  </div>;
}
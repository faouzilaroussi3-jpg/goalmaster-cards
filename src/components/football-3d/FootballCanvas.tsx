import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";
export { preloadAthlete } from "./Athlete";
import { cinematicPalette } from "@/lib/cinematic-3d";

export default function FootballCanvas({ tier, onComplete }: { tier: number; onComplete: () => void }) {
  const palette = useMemo(() => cinematicPalette(tier), [tier]);
  const [ready, setReady] = useState(false);
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const t = setTimeout(onComplete, 20000); return () => clearTimeout(t); }, [onComplete]);
  return <div className="absolute inset-0" data-renderer="3d" data-ready={ready}>
    <Canvas shadows dpr={1} camera={{ position: [3, 2.5, 6], fov: 52 }} gl={{ antialias: true, powerPreference: "high-performance" }}><Scene tier={tier} palette={palette} reduced={reduced} onReady={() => setReady(true)} onComplete={onComplete} /></Canvas>
    <div className="cinema-3d-vignette" />
  </div>;
}
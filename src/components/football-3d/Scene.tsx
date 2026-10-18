import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3, PerspectiveCamera } from "three";
import { Athlete } from "./Athlete";
import { Stadium } from "./Stadium";
import { FootballEffects } from "./Effects";
import { cinematicProgress, ballPosition, type CinemaPalette } from "@/lib/cinematic-3d";

export function Scene({ tier, palette, reduced, onReady, onComplete }: { tier: number; palette: CinemaPalette; reduced: boolean; onReady: () => void; onComplete: () => void }) {
  const elapsed = useRef(0); const progress = useRef(0); const ready = useRef(false); const ended = useRef(false); const target = useRef(new Vector3());
  const handleReady = useRef(() => { ready.current = true; onReady(); }).current;
  useFrame(({ camera }, rawDelta) => {
    if (!ready.current || ended.current) return;
    const dt = Math.min(rawDelta, .05); elapsed.current += dt;
    const p = reduced ? .15 : cinematicProgress(elapsed.current, tier); progress.current = p;
    if ((reduced && elapsed.current > 1) || p >= 1) { ended.current = true; onComplete(); }
    const orbit = reduced ? .5 : -.7 + p * (tier >= 5 ? 4.4 : 1.8);
    const radius = p > .65 ? 6.5 : 5.2 - Math.sin(p * Math.PI) * 1.1;
    target.current.set(Math.sin(orbit) * radius, 1.6 + Math.sin(p * Math.PI) * 2.5, Math.cos(orbit) * radius);
    if (p > .65) { const ball = ballPosition(p, tier); target.current.set(ball[0] + 3, ball[1] + 1.8, ball[2] + 5); }
    camera.position.lerp(target.current, 1 - Math.exp(-7 * dt));
    camera.lookAt(p > .65 ? 1 : 0, p > .65 ? 1.7 : 1.8 + Math.sin(p * Math.PI) * .5, p > .65 ? -6 : 0);
    if (!reduced) camera.rotation.z += Math.sin(p * Math.PI * 3) * (tier >= 5 ? .16 : .04);
    if (camera instanceof PerspectiveCamera) { camera.fov = 52 + Math.sin(p * Math.PI) * 12; camera.updateProjectionMatrix(); }
  }, -1);
  return <>
    <Stadium palette={palette} />
    <Suspense fallback={<Html center><span className="font-display text-xl text-primary">Préparation…</span></Html>}><Athlete time={progress} tier={tier} palette={palette} onReady={handleReady} /></Suspense>
    <FootballEffects time={progress} tier={tier} palette={palette} />
  </>;
}
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const Scene = lazy(async () => {
  const [{ Canvas }, drei, m] = await Promise.all([import("@react-three/fiber"), import("@react-three/drei"), import("@/components/avatar/Avatar3D")]);
  return {
    default: () => (
      <Canvas camera={{ position: [0, 0.45, 1.5], fov: 40 }}>
        <color attach="background" args={["#0b0a0e"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        <drei.Environment resolution={128}>
          <drei.Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <drei.Lightformer intensity={1.5} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <drei.Lightformer intensity={1.2} color="#ffe2a8" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
        </drei.Environment>
        <m.RareCardTrophy position={[-0.45, 0, 0]} />
        <m.GoldenBall position={[0, 0, 0]} />
        <m.WinsCup position={[0.45, 0, 0]} />
      </Canvas>
    ),
  };
});

export const Route = createFileRoute("/trophy-preview")({
  head: () => ({ meta: [{ title: "Aperçu trophées" }, { name: "description", content: "Aperçu temporaire." }, { property: "og:title", content: "Aperçu trophées" }, { property: "og:description", content: "Aperçu temporaire." }] }),
  component: () => {
    const [ok, setOk] = useState(false);
    useEffect(() => setOk(true), []);
    return <div style={{ height: "100vh" }}>{ok && <Suspense fallback={null}><Scene /></Suspense>}</div>;
  },
});

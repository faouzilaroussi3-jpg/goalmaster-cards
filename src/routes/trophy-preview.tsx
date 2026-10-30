import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { GoldenBall } from "@/components/avatar/Avatar3D";

// TEMP preview page (removed after check)
export const Route = createFileRoute("/trophy-preview")({
  ssr: false,
  component: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#111" }} data-scene-ready>
      <Canvas camera={{ position: [0, 0.32, 0.75], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}>
        <color attach="background" args={["#1a0d14"]} />
        <ambientLight intensity={0.3} />
        <spotLight position={[1, 2, 1.5]} intensity={8} angle={0.5} />
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={1.5} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1.2} color="#ffe2a8" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
        </Environment>
        <GoldenBall position={[0, 0, 0]} />
      </Canvas>
    </div>
  ),
});

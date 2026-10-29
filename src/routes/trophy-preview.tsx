import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { GoldenBall } from "@/components/avatar/Avatar3D";
export const Route = createFileRoute("/trophy-preview")({ ssr: false, component: () => (
  <div style={{ width: 800, height: 800, background: "#111" }} data-scene-ready>
    <Canvas camera={{ position: [0, 0.45, 1.1], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 0.28, 0)}>
      <ambientLight intensity={0.3} /><directionalLight position={[2, 3, 2]} intensity={2} />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={1.5} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        <Lightformer intensity={1.2} color="#ffe2a8" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
      </Environment>
      <GoldenBall />
    </Canvas>
  </div>) });

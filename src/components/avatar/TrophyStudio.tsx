import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { TrophyKind } from "@/lib/ballon-dor";
import type { TrophyDesign } from "@/lib/trophy-design";
import { TrophyModel } from "./Avatar3D";

/** Admin trophy workshop: one trophy turning on a lit plinth, drawn from an unsaved design so edits show live. */
export default function TrophyStudio({ kind, design }: { kind: TrophyKind; design: TrophyDesign }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0.42, 1.25], fov: 35 }}>
      <color attach="background" args={["#0b0a0e"]} />
      <fog attach="fog" args={["#0b0a0e", 3, 8]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[1.5, 3, 2]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[-1.5, 2, 1]} angle={0.5} penumbra={0.8} intensity={8} color="#ff2d87" />
      <pointLight position={[0, 0.6, 1]} intensity={0.5} color="#ffffff" />
      <Suspense fallback={null}>
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={1.2} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1} color="#ffffff" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
        </Environment>
      </Suspense>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#141218" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.32, 0.34, 0.04, 48]} />
        <meshStandardMaterial color="#1c1a22" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.041, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.3, 0.32, 64]} />
        <meshStandardMaterial color="#ff2d87" emissive="#ff2d87" emissiveIntensity={2} />
      </mesh>
      <TrophyModel kind={kind} design={design} position={[0, 0.04, 0]} />
      <ContactShadows position={[0, 0.042, 0]} opacity={0.5} scale={1} blur={2} far={0.6} />
      <OrbitControls target={[0, 0.27, 0]} autoRotate autoRotateSpeed={1.2} enablePan={false} minDistance={0.6} maxDistance={2.2} minPolarAngle={0.5} maxPolarAngle={1.6} />
    </Canvas>
  );
}

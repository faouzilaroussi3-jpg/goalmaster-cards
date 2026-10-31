import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarLook } from "@/lib/avatar";
import { Avatar3D, TrophyCase, type AvatarPose } from "./Avatar3D";
import type { TrophyKind } from "@/lib/ballon-dor";

/** Turns the avatar smoothly to face front (0) or back (π). */
function Turntable({ back, children }: { back: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!ref.current) return;
    const target = back ? Math.PI : 0;
    ref.current.rotation.y += (target - ref.current.rotation.y) * (1 - Math.exp(-6 * dt));
  });
  return <group ref={ref}>{children}</group>;
}

/** Locker-room podium: the avatar on a lit plinth with its Ballon d'Or cabinet behind. */
export default function AvatarStage({ look, trophies, others = [], back = false, pose = "idle" }: { look: AvatarLook; trophies: number; others?: TrophyKind[]; back?: boolean; pose?: AvatarPose }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 1.45, 3.6], fov: 40 }}>
      <color attach="background" args={["#0b0a0e"]} />
      <fog attach="fog" args={["#0b0a0e", 6, 14]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[-2.5, 3.5, 1.5]} angle={0.5} penumbra={0.8} intensity={18} color="#ff2d87" />
      <pointLight position={[0, 1.2, 2]} intensity={0.6} color="#ffffff" />
      <Suspense fallback={null}>
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={1.2} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1} color="#ffffff" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
        </Environment>
      </Suspense>
      {/* Floor + plinth */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial color="#141218" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.75, 0.8, 0.12, 48]} />
        <meshStandardMaterial color="#1c1a22" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.121, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.7, 0.75, 64]} />
        <meshStandardMaterial color="#ff2d87" emissive="#ff2d87" emissiveIntensity={2} />
      </mesh>
      <TrophyCase count={trophies} others={others} position={[0, 0, -1.25]} />
      <Turntable back={back}>
        <Avatar3D look={look} pose={pose} position={[0, 0.12, 0]} seed="me" />
      </Turntable>
      <ContactShadows position={[0, 0.125, 0]} opacity={0.5} scale={3} blur={2.4} far={2} />
      <OrbitControls target={[0, 1.05, 0]} enablePan={false} minDistance={2.2} maxDistance={6} minPolarAngle={0.6} maxPolarAngle={1.65} />
    </Canvas>
  );
}

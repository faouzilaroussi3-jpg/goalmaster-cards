import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarLook } from "@/lib/avatar";
import { seatPosition } from "@/lib/ballon-dor";
import { Avatar3D, GoldenBall, TrophyCase, type AvatarPose } from "./Avatar3D";

export interface Guest { id: string; name: string; look: AvatarLook; trophies: number }
export type CeremonyView = "stage" | "hall";

// Reveal timeline (seconds after the admin names the winner).
const T_SPOT = 3.2, T_STAGE = 6.4, T_CAM_BACK = 13;
const STAGE_Y = 0.5;
const WINNER_SPOT = new THREE.Vector3(0, STAGE_Y, -2);
const BACKSTAGE = new THREE.Vector3(4.2, STAGE_Y, -3.6);
const HOST_SPOT: [number, number, number] = [-2.2, STAGE_Y, -2.3];
type Phase = "waiting" | "drumroll" | "walk" | "trophy" | "done";

function phaseAt(t: number): Phase {
  if (t < T_SPOT) return "drumroll";
  if (t < T_STAGE) return "walk";
  return "trophy";
}

function NameTag({ name, trophies, me, y = 2.12 }: { name: string; trophies: number; me?: boolean; y?: number }) {
  return (
    <Html position={[0, y, 0]} center distanceFactor={12} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${me ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/80 text-foreground"}`}>
        {name}{trophies > 0 ? ` · ${trophies}×★` : ""}
      </div>
    </Html>
  );
}

/** Visible light cone from `from` towards a moving target. */
function Beam({ from, target, color = "#fff4e0", width = 0.9 }: { from: THREE.Vector3; target: React.MutableRefObject<THREE.Vector3>; color?: string; width?: number }) {
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!g.current || !m.current) return;
    g.current.position.copy(from);
    g.current.lookAt(target.current);
    const len = from.distanceTo(target.current);
    m.current.scale.set(width, len, width);
    m.current.position.set(0, 0, len / 2);
  });
  return (
    <group ref={g}>
      <mesh ref={m} rotation-x={-Math.PI / 2}>
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Confetti({ active }: { active: boolean }) {
  const N = 260;
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => Array.from({ length: N }, () => ({
    p: new THREE.Vector3((Math.random() - 0.5) * 12, 6 + Math.random() * 6, -3 + Math.random() * 10),
    v: 0.8 + Math.random() * 1.2, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: Math.random() * 3 + 1,
  })), []);
  const colors = useMemo(() => ["#ff2d87", "#ffffff", "#ffd75e", "#ff7ab6"], []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    parts.forEach((_, i) => mesh.setColorAt(i, c.set(colors[i % colors.length] ?? "#ffffff")));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [parts, colors]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = active;
    if (!active) return;
    parts.forEach((q, i) => {
      q.p.y -= q.v * dt;
      q.p.x += Math.sin(q.p.y * 2 + i) * dt * 0.3;
      q.r.x += dt * q.s; q.r.y += dt * q.s * 0.7;
      if (q.p.y < 0) q.p.y = 7 + Math.random() * 3;
      dummy.position.copy(q.p); dummy.rotation.copy(q.r); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <planeGeometry args={[0.07, 0.11]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.4} metalness={0.3} emissive="#330018" />
    </instancedMesh>
  );
}

function CameraRig({ view, focus }: { view: CeremonyView; focus: React.MutableRefObject<THREE.Vector3 | null> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.2, 0));
  const snapped = useRef(false);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    // First frame jumps straight to the chosen view; afterwards the camera glides.
    const k = snapped.current ? 1 - Math.exp(-2.2 * dt) : 1;
    snapped.current = true;
    let pos: THREE.Vector3, at: THREE.Vector3;
    if (focus.current) {
      pos = focus.current.clone().add(new THREE.Vector3(1.8, 1.7, 3.4));
      at = focus.current.clone().add(new THREE.Vector3(0, 1.25, 0));
    } else if (view === "stage") {
      pos = new THREE.Vector3(-3.4, 3.1, -4.5);
      at = new THREE.Vector3(0.6, 0.9, 6);
    } else {
      pos = new THREE.Vector3(0, 4.3, 12.8);
      at = new THREE.Vector3(0, 1.4, -2.6);
    }
    camera.position.lerp(pos, k);
    look.current.lerp(at, k);
    camera.lookAt(look.current);
  });
  return null;
}

/** Velvet gala chairs behind every audience spot (one instanced draw call). */
function Seats({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [x, y, z] = seatPosition(i);
      d.position.set(x, y + 0.55, z + 0.45);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.7, 1.1, 0.14]} />
      <meshStandardMaterial color="#5a0f33" roughness={0.85} />
    </instancedMesh>
  );
}

function Hall({ rows }: { rows: number }) {
  return (
    <group>
      <Seats count={rows * 8} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 4]}>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#0c0a0e" roughness={0.9} />
      </mesh>
      {/* Pink carpet from the seats to the stage */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 4.5]}>
        <planeGeometry args={[1.3, 13]} />
        <meshStandardMaterial color="#b0125a" roughness={0.9} emissive="#3a0420" />
      </mesh>
      {/* Audience risers */}
      {Array.from({ length: rows }, (_, r) => {
        const [, y, z] = seatPosition(r * 8);
        return y > 0 ? (
          <mesh key={r} position={[0, y / 2, z]}>
            <boxGeometry args={[11.5, y, 1.5]} />
            <meshStandardMaterial color="#1b171f" roughness={0.7} />
          </mesh>
        ) : null;
      })}
      {/* Stage */}
      <mesh position={[0, STAGE_Y / 2, -3.3]}>
        <boxGeometry args={[10, STAGE_Y, 3.6]} />
        <meshStandardMaterial color="#0f0d12" roughness={0.25} metalness={0.5} />
      </mesh>
      <mesh position={[0, STAGE_Y - 0.03, -1.49]}>
        <boxGeometry args={[10, 0.04, 0.04]} />
        <meshStandardMaterial color="#ff2d87" emissive="#ff2d87" emissiveIntensity={3} />
      </mesh>
      {/* Steps to the stage on the carpet */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, (i + 1) * 0.16 - 0.08, -1.2 + -i * 0.25]}>
          <boxGeometry args={[1.3, 0.16 * (i + 1), 0.3]} />
          <meshStandardMaterial color="#1b171f" roughness={0.6} />
        </mesh>
      ))}
      {/* Backdrop with a gold ring and light columns */}
      <mesh position={[0, 3, -5.1]}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#09080b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.2, -5]}>
        <torusGeometry args={[1.45, 0.06, 16, 96]} />
        <meshStandardMaterial color="#ffd75e" emissive="#c8901a" emissiveIntensity={1.6} metalness={1} roughness={0.2} />
      </mesh>
      {[-6, -4.2, 4.2, 6].map((x) => (
        <mesh key={x} position={[x, 3, -5]}>
          <boxGeometry args={[0.12, 5, 0.05]} />
          <meshStandardMaterial color="#ff2d87" emissive="#ff2d87" emissiveIntensity={2.2} />
        </mesh>
      ))}
      {/* Lectern for the host */}
      <mesh position={[HOST_SPOT[0] - 0.7, STAGE_Y + 0.55, HOST_SPOT[2] + 0.1]}>
        <boxGeometry args={[0.55, 1.1, 0.4]} />
        <meshStandardMaterial color="#1a1720" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Trophy pedestal */}
      <mesh position={[0, STAGE_Y + 0.45, -3.1]}>
        <cylinderGeometry args={[0.32, 0.38, 0.9, 32]} />
        <meshStandardMaterial color="#141218" roughness={0.25} metalness={0.7} />
      </mesh>
    </group>
  );
}

function Show({ audience, host, winner, revealAt, view, myId }: {
  audience: Guest[]; host: Guest | null; winner: Guest | null; revealAt: number | null; view: CeremonyView; myId: string;
}) {
  const [phase, setPhase] = useState<Phase>(winner ? (revealAt ? "drumroll" : "done") : "waiting");
  const winnerRef = useRef<THREE.Group>(null);
  const spotTarget = useRef(new THREE.Vector3(0, 0, 4));
  const focus = useRef<THREE.Vector3 | null>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const { scene } = useThree();
  useEffect(() => {
    const target = spot.current?.target;
    if (!target) return;
    scene.add(target);
    return () => { scene.remove(target); };
  }, [scene]);
  const seatIndex = winner ? audience.findIndex((g) => g.id === winner.id) : -1;
  const start = useMemo(() => (seatIndex >= 0 ? new THREE.Vector3(...seatPosition(seatIndex)) : BACKSTAGE.clone()), [seatIndex]);
  const rows = Math.max(3, Math.ceil(audience.length / 8));

  const winnerId = winner?.id ?? null;
  useEffect(() => { setPhase(winnerId ? (revealAt ? "drumroll" : "done") : "waiting"); }, [winnerId, revealAt]);

  useFrame(({ clock }) => {
    spot.current?.target.position.copy(spotTarget.current);
    const t = revealAt ? (Date.now() - revealAt) / 1000 : -1;
    if (winner && revealAt) {
      const p = phaseAt(t);
      if (p !== phase && phase !== "done") setPhase(p);
    }
    // Follow spot: sweeps the crowd during the drum roll, then lands on the winner.
    const w = winnerRef.current;
    if (phase === "waiting" || !winner) {
      const a = clock.elapsedTime * 0.35;
      spotTarget.current.set(Math.sin(a) * 4, 0.6, 4 + Math.cos(a * 0.7) * 2.5);
      focus.current = null;
      return;
    }
    if (phase === "drumroll") {
      const s = Math.min(1, t / T_SPOT);
      const wander = new THREE.Vector3(Math.sin(t * 2.6) * 4.5 * (1 - s), 0.5, 5 + Math.cos(t * 1.9) * 2.5 * (1 - s));
      spotTarget.current.copy(wander.lerp(start, s * s));
      focus.current = null;
    }
    if (!w) return;
    if (phase === "drumroll") { w.position.copy(start); w.rotation.y = seatIndex >= 0 ? Math.PI : -Math.PI / 2; }
    if (phase === "walk") {
      const s = THREE.MathUtils.smoothstep((t - T_SPOT) / (T_STAGE - T_SPOT), 0, 1);
      const p = start.clone().lerp(WINNER_SPOT, s);
      p.y = THREE.MathUtils.lerp(start.y, WINNER_SPOT.y, Math.min(1, s * 1.6));
      w.position.copy(p);
      const dir = WINNER_SPOT.clone().sub(start);
      w.rotation.y = Math.atan2(dir.x, dir.z);
      spotTarget.current.copy(p);
      focus.current = p.clone();
    }
    if (phase === "trophy" || phase === "done") {
      w.position.copy(WINNER_SPOT);
      w.rotation.y += (0 - w.rotation.y) * 0.08;
      spotTarget.current.copy(WINNER_SPOT);
      focus.current = phase === "trophy" && t < T_CAM_BACK ? WINNER_SPOT.clone() : null;
    }
  });

  const crowdPose = (i: number): AvatarPose => (phase === "walk" ? "clap" : phase === "trophy" ? (i % 3 === 0 ? "cheer" : "clap") : "idle");
  const winnerPose: AvatarPose = phase === "walk" ? "walk" : phase === "trophy" || phase === "done" ? "trophy" : "idle";
  const showTrophyOnPedestal = !winner || phase === "drumroll" || phase === "walk";

  return (
    <>
      <CameraRig view={view} focus={focus} />
      <Hall rows={rows} />
      {showTrophyOnPedestal && <GoldenBall position={[0, STAGE_Y + 0.9, -3.1]} scale={1.5} />}
      <Beam from={new THREE.Vector3(0, 7.5, 9)} target={spotTarget} width={0.75} />
      <spotLight ref={spot} position={[0, 7.5, 9]} angle={0.16} penumbra={0.6} intensity={140} color="#fff4e0" distance={30} />
      {audience.map((g, i) => (g.id === winner?.id && phase !== "waiting") ? null : (
        <group key={g.id} position={seatPosition(i)} rotation-y={Math.PI}>
          <Avatar3D look={g.look} pose={crowdPose(i)} detail="low" seed={g.id} />
          <NameTag name={g.name} trophies={g.trophies} me={g.id === myId} />
        </group>
      ))}
      {host && (host.id !== winner?.id || phase === "waiting") && (
        <group position={HOST_SPOT} rotation-y={0.35}>
          <Avatar3D look={host.look} pose={phase === "trophy" ? "clap" : "idle"} seed={host.id} />
          <NameTag name={`${host.name} · Présentateur`} trophies={0} me={host.id === myId} />
        </group>
      )}
      {winner && phase !== "waiting" && (
        <>
          <group ref={winnerRef} position={start}>
            <Avatar3D look={winner.look} pose={winnerPose} seed={winner.id} />
            <NameTag name={winner.name} trophies={winner.trophies} me={winner.id === myId} y={phase === "trophy" || phase === "done" ? 2.85 : 2.12} />
          </group>
          {(phase === "trophy" || phase === "done") && <TrophyCase count={winner.trophies} position={[0, STAGE_Y, -4.45]} scale={0.95} />}
        </>
      )}
      <Confetti active={phase === "trophy"} />
    </>
  );
}

/** Ballon d'Or gala hall: stage with the trophy, the admin as host, connected players' avatars in the stands. */
export default function CeremonyScene(props: { audience: Guest[]; host: Guest | null; winner: Guest | null; revealAt: number | null; view: CeremonyView; myId: string }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 4.3, 12.8], fov: 50 }} gl={{ antialias: true }}>
      <color attach="background" args={["#070609"]} />
      <fog attach="fog" args={["#070609", 14, 32]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ffd9ec", "#140b12", 0.5]} />
      <directionalLight position={[3, 8, 6]} intensity={0.9} />
      <spotLight position={[-5, 6, 0]} angle={0.5} penumbra={0.7} intensity={70} color="#ff2d87" distance={20} />
      <spotLight position={[5, 6, 0]} angle={0.5} penumbra={0.7} intensity={70} color="#ff7ab6" distance={20} />
      <pointLight position={[0, 3, -1]} intensity={6} distance={9} color="#ffe2a8" />
      <Suspense fallback={null}>
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
          <Lightformer intensity={1.5} color="#ff7ab6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={1.2} color="#ffe2a8" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1.5, 1]} />
        </Environment>
      </Suspense>
      <Show {...props} />
    </Canvas>
  );
}

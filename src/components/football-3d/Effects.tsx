import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Group, Mesh, CanvasTexture } from "three";
import { Trail } from "@react-three/drei";
import { ballPosition, type CinemaPalette } from "@/lib/cinematic-3d";

export function FootballEffects({ time, tier, palette }: { time: React.RefObject<number>; tier: number; palette: CinemaPalette }) {
  const ball = useRef<Mesh>(null); const particles = useRef<InstancedMesh>(null); const rings = useRef<Group>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const ballMap = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 128; const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.white; ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = palette.player;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) { ctx.beginPath(); for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; const px = x * 48 + y % 2 * 24 + Math.cos(a) * 12; const py = y * 45 + Math.sin(a) * 12; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); }
    }
    return new CanvasTexture(canvas);
  }, [palette]);
  useFrame(() => {
    const p = time.current;
    const pos = ballPosition(p, tier);
    if (ball.current) { ball.current.position.set(...pos); ball.current.rotation.set(p * 20, p * 17, p * 9); }
    const explosion = Math.max(0, (p - .66) / .34);
    if (rings.current) { rings.current.position.set(...pos); rings.current.scale.setScalar(.1 + explosion * 12); rings.current.visible = explosion > 0; rings.current.rotation.z = explosion * 3; }
    if (particles.current) {
      for (let i = 0; i < 180; i++) {
        const angle = i * 2.399; const radius = explosion > 0 ? explosion * (4 + i % 7) : 2.5 + i % 6 * .5;
        dummy.position.set(Math.cos(angle + p * 3) * radius, explosion > 0 ? 1.7 + Math.sin(i * 11) * radius : .2 + i % 13 * .35, -6 + Math.sin(angle + p * 2) * radius);
        dummy.rotation.set(angle + p * 9, angle, p * 6); dummy.scale.setScalar(explosion > 0 ? .07 * (1 - explosion) + .01 : tier >= 5 ? .025 : .009);
        dummy.updateMatrix(); particles.current.setMatrixAt(i, dummy.matrix);
      }
      particles.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <>
    <Trail width={tier >= 5 ? 3 : 1.4} length={7} color={palette.accent} attenuation={(t) => t * t}><mesh ref={ball} castShadow><sphereGeometry args={[.23, 24, 16]} /><meshStandardMaterial map={ballMap} roughness={.35} metalness={.1} emissive={palette.accent} emissiveIntensity={.2} /></mesh></Trail>
    <instancedMesh ref={particles} args={[undefined, undefined, 180]} frustumCulled={false}><octahedronGeometry args={[1]} /><meshBasicMaterial color={palette.accent} /></instancedMesh>
    <group ref={rings}>{[0, 1, 2].map((i) => <mesh key={i} rotation={[i * .4, i * .5, 0]}><torusGeometry args={[.7 + i * .3, .014, 8, 64]} /><meshBasicMaterial color={i === 1 ? palette.white : palette.accent} transparent opacity={.8} /></mesh>)}</group>
  </>;
}
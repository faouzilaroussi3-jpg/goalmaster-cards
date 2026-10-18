import { useEffect, useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, BufferGeometry, Float32BufferAttribute } from "three";
import type { CinemaPalette } from "@/lib/cinematic-3d";

export function Stadium({ palette }: { palette: CinemaPalette }) {
  const turf = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.grass; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = palette.grassLight; ctx.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 8000; i++) { ctx.globalAlpha = .12; ctx.fillStyle = i % 2 ? palette.white : palette.dark; ctx.fillRect((i * 73) % 256, (i * 127 + Math.floor(i / 256)) % 256, 1, 3); }
    }
    const texture = new CanvasTexture(canvas); texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(5, 5); texture.anisotropy = 4;
    return texture;
  }, [palette]);
  const net = useMemo(() => {
    const p: number[] = [];
    for (let x = -3.4; x <= 3.4; x += .25) p.push(x, 0, -9, x, 3.2, -9);
    for (let y = 0; y <= 3.2; y += .25) p.push(-3.4, y, -9, 3.4, y, -9);
    const geo = new BufferGeometry(); geo.setAttribute("position", new Float32BufferAttribute(p, 3)); return geo;
  }, []);
  useEffect(() => () => { turf.dispose(); net.dispose(); }, [turf, net]);
  return <>
    <color attach="background" args={[palette.dark]} />
    <fog attach="fog" args={[palette.dark, 16, 46]} />
    <ambientLight intensity={.5} />
    <directionalLight position={[5, 9, 4]} intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
    <pointLight position={[-3, 4, -3]} color={palette.accent} intensity={70} distance={16} />
    <pointLight position={[4, 5, 1]} color={palette.electric} intensity={40} distance={14} />
    <Environment resolution={64}><Lightformer intensity={3} color={palette.accent} position={[0, 5, -5]} scale={[12, 4, 1]} /><Lightformer intensity={2} color={palette.white} position={[-5, 4, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} /></Environment>
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[70, 70]} /><meshStandardMaterial map={turf} roughness={.75} metalness={.18} /></mesh>
    <mesh position={[0, .014, -2]} rotation-x={-Math.PI / 2}><ringGeometry args={[3.95, 4, 80]} /><meshBasicMaterial color={palette.white} transparent opacity={.45} /></mesh>
    <mesh position={[0, .02, -5]} rotation-x={-Math.PI / 2}><planeGeometry args={[.045, 30]} /><meshBasicMaterial color={palette.white} transparent opacity={.4} /></mesh>
    <lineSegments geometry={net}><lineBasicMaterial color={palette.white} transparent opacity={.3} /></lineSegments>
    {[-3.4, 3.4].map((x) => <mesh key={x} position={[x, 1.6, -8.8]}><cylinderGeometry args={[.065, .065, 3.2, 12]} /><meshStandardMaterial color={palette.white} metalness={.7} roughness={.22} /></mesh>)}
    <mesh position={[0, 3.2, -8.8]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.065, .065, 6.9, 12]} /><meshStandardMaterial color={palette.white} metalness={.7} roughness={.22} /></mesh>
    {[0, 1, 2].map((row) => <mesh key={row} position={[0, 1 + row * 1.1, -13 - row * 1.6]}><boxGeometry args={[35, .8, 1.5]} /><meshStandardMaterial color={palette.dark} roughness={.6} /></mesh>)}
    {[-12, 12].map((x) => <group key={x} position={[x, 0, -7]}><mesh position-y={5}><cylinderGeometry args={[.08, .13, 10, 8]} /><meshStandardMaterial color={palette.white} metalness={.6} /></mesh><mesh position-y={10}><boxGeometry args={[3, .4, .3]} /><meshBasicMaterial color={palette.white} /></mesh></group>)}
    {Array.from({ length: 30 }, (_, i) => <mesh key={i} position={[-17 + i * 1.2, 2.2 + i % 3, -12 - i % 3 * 1.6]}><planeGeometry args={[.15, .08]} /><meshBasicMaterial color={i % 3 ? palette.accent : palette.electric} /></mesh>)}
  </>;
}
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarLook } from "@/lib/avatar";
import { inkOn, kitFor, type Kit } from "@/lib/kits";

export type AvatarPose = "idle" | "clap" | "cheer" | "trophy" | "walk";

/** Bumps once web fonts are ready so canvas-printed names use Bebas Neue. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.load('120px "Bebas Neue"').catch(() => null).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}

/**
 * Shirt texture wrapped round the torso lathe: u = 0 is the chest centre, u = 0.5 the back centre.
 * Draws the club pattern, collar trim, a plain crest and the name + number on the back.
 */
function drawShirt(kit: Kit, name: string, number: number, fonts: boolean): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = kit.shirt;
  g.fillRect(0, 0, W, H);
  g.fillStyle = kit.alt;
  if (kit.pattern === "stripes") for (let x = 0; x < W; x += 64) g.fillRect(x + 32, 0, 32, H);
  if (kit.pattern === "hoops") for (let y = 0; y < H; y += 96) g.fillRect(0, y + 48, W, 48);
  if (kit.pattern === "halves") g.fillRect(W / 2, 0, W / 2, H);
  if (kit.pattern === "band") { g.fillRect(0, 0, 90, H); g.fillRect(W - 90, 0, 90, H); g.fillRect(W / 2 - 90, 0, 180, H); }
  if (kit.pattern === "sash") {
    // Front panel spans u ∈ [-0.25, 0.25]: draw it on its own canvas then wrap it round the seam.
    const f = document.createElement("canvas");
    f.width = 512; f.height = H;
    const fg = f.getContext("2d")!;
    fg.strokeStyle = kit.alt;
    fg.lineWidth = 110;
    fg.beginPath(); fg.moveTo(40, -20); fg.lineTo(480, H + 20); fg.stroke();
    g.drawImage(f, 256, 0, 256, H, 0, 0, 256, H);
    g.drawImage(f, 0, 0, 256, H, W - 256, 0, 256, H);
  }
  // Collar + hem.
  g.fillStyle = kit.trim;
  g.fillRect(0, 0, W, 26);
  g.fillRect(0, H - 14, W, 14);
  const backInk = kit.pattern === "stripes" || kit.pattern === "hoops" ? inkOn(kit.alt === kit.shirt ? kit.shirt : "#888888") : inkOn(kit.pattern === "halves" ? kit.alt : kit.shirt);
  const font = fonts ? '"Bebas Neue", Impact, sans-serif' : "Impact, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  const outline = backInk === "#ffffff" ? "#000000" : "#ffffff";
  // Name and big number on the back (u = 0.5).
  if (name) {
    g.font = `76px ${font}`;
    g.lineWidth = 8; g.strokeStyle = outline; g.strokeText(name, W / 2, 96, 330);
    g.fillStyle = backInk; g.fillText(name, W / 2, 96, 330);
  }
  g.font = `250px ${font}`;
  g.lineWidth = 14; g.strokeStyle = outline; g.strokeText(String(number), W / 2, name ? 270 : 230);
  g.fillStyle = backInk; g.fillText(String(number), W / 2, name ? 270 : 230);
  // Small number on the chest (u ≈ 0) and a plain crest on the left chest (u ≈ 0.09).
  g.font = `70px ${font}`;
  g.fillText(String(number), 0, 150);
  g.fillText(String(number), W, 150);
  g.beginPath(); g.arc(92, 110, 30, 0, Math.PI * 2);
  g.fillStyle = kit.trim; g.fill();
  g.lineWidth = 5; g.strokeStyle = outline; g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Torso profile at even heights so the shirt texture is not stretched (lathe v follows point index).
const TORSO_Y0 = 0.84, TORSO_Y1 = 1.4;
const TORSO_POINTS = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13;
  const r = 0.19 + 0.045 * Math.sin(t * Math.PI * 0.85) - (t > 0.82 ? (t - 0.82) * 0.75 : 0);
  return new THREE.Vector2(Math.max(0.07, r), TORSO_Y0 + t * (TORSO_Y1 - TORSO_Y0));
});
const torsoGeo = new THREE.LatheGeometry(TORSO_POINTS, 40);
const headGeo = new THREE.SphereGeometry(0.17, 32, 24);
const capGeo = new THREE.SphereGeometry(0.182, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
const buzzGeo = new THREE.SphereGeometry(0.174, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
const limbGeo = new THREE.CapsuleGeometry(1, 1, 6, 14);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);

/** Deterministic pseudo-random so audience avatars sway out of sync without Math.random at render. */
function seeded(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return (h % 1000) / 1000;
}

function Limb({ len, r, color, position, rough = 0.6 }: { len: number; r: number; color: string; position: [number, number, number]; rough?: number }) {
  return (
    <mesh geometry={limbGeo} position={position} scale={[r, len / 2, r]} castShadow>
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Hair({ style, color, detail }: { style: AvatarLook["hair"]; color: string; detail: boolean }) {
  const mat = <meshStandardMaterial color={color} roughness={0.75} />;
  if (style === "bald") return null;
  const cap = <mesh geometry={style === "buzz" || style === "mohawk" ? buzzGeo : capGeo} rotation-x={-0.25} position={[0, 0.01, -0.01]} castShadow>{mat}</mesh>;
  switch (style) {
    case "afro":
      return <mesh position={[0, 0.07, -0.02]} scale={[0.26, 0.24, 0.25]} geometry={sphereGeo} castShadow>{mat}</mesh>;
    case "curly":
      return (
        <group>
          {cap}
          {detail && Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <mesh key={i} geometry={sphereGeo} scale={0.055} position={[Math.cos(a) * 0.13, 0.1 + (i % 2) * 0.03, Math.sin(a) * 0.13 - 0.02]}>{mat}</mesh>;
          })}
          <mesh geometry={sphereGeo} scale={[0.15, 0.08, 0.15]} position={[0, 0.15, -0.01]}>{mat}</mesh>
        </group>
      );
    case "long":
      return (
        <group>
          {cap}
          <mesh position={[0, -0.12, -0.09]} castShadow>
            <boxGeometry args={[0.34, 0.32, 0.12]} />
            {mat}
          </mesh>
        </group>
      );
    case "mohawk":
      return (
        <group>
          {cap}
          {[-0.1, -0.04, 0.02, 0.08].map((z, i) => (
            <mesh key={i} position={[0, 0.17 - Math.abs(z) * 0.3, z - 0.02]} rotation-x={-0.3 + i * 0.15}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              {mat}
            </mesh>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          {cap}
          <mesh geometry={sphereGeo} scale={0.075} position={[0, 0.15, -0.1]}>{mat}</mesh>
        </group>
      );
    case "dreads":
      return (
        <group>
          {cap}
          {(detail ? Array.from({ length: 12 }, (_, i) => i) : [0, 3, 6, 9]).map((i) => {
            const a = Math.PI * 0.15 + (i / 11) * Math.PI * 0.7;
            return <mesh key={i} geometry={limbGeo} scale={[0.022, 0.1, 0.022]} position={[Math.cos(a) * 0.16, -0.08, -Math.sin(a) * 0.15]}>{mat}</mesh>;
          })}
        </group>
      );
    default:
      return cap;
  }
}

function Shoe({ x, style, color }: { x: number; style: AvatarLook["shoes"]; color: string }) {
  const h = style === "high" ? 0.15 : 0.085;
  const w = style === "speed" ? 0.1 : 0.115;
  return (
    <group position={[x, 0, 0.035]}>
      <RoundedBox args={[w, h, 0.25]} radius={0.035} smoothness={3} position={[0, h / 2, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {/* Sole + studs strip */}
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[w + 0.006, 0.016, 0.255]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      {style === "speed" && (
        <mesh position={[w / 2 + 0.001, h * 0.55, -0.01]} rotation-z={0.25}>
          <boxGeometry args={[0.004, 0.03, 0.17]} />
          <meshStandardMaterial color={inkOn(color)} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Stylised footballer figurine, front facing +z, feet at y = 0, about 1.8 tall.
 * `detail="low"` drops small face and hair parts for crowds.
 */
export function Avatar3D({
  look, pose = "idle", detail = "high", seed = "", ...group
}: { look: AvatarLook; pose?: AvatarPose; detail?: "high" | "low"; seed?: string } & JSX.IntrinsicElements["group"]) {
  const fonts = useFontsReady();
  const kit = kitFor(look.club);
  const shirtTex = useMemo(() => drawShirt(kit, look.shirtName, look.number, fonts), [kit, look.shirtName, look.number, fonts]);
  useEffect(() => () => shirtTex.dispose(), [shirtTex]);
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const phase = useMemo(() => seeded(seed) * Math.PI * 2, [seed]);
  const high = detail === "high";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    const a = armL.current, b = armR.current;
    if (!a || !b || !root.current) return;
    let la = 0.14, ra = -0.14, lx = 0, rx = 0, bob = Math.sin(t * 2) * 0.008, legSwing = 0;
    if (pose === "idle") { la += Math.sin(t * 1.6) * 0.04; ra -= Math.sin(t * 1.6) * 0.04; lx = Math.sin(t * 1.1) * 0.06; rx = -lx; }
    if (pose === "clap") { const c = Math.abs(Math.sin(t * 9)); lx = -1.25; rx = -1.25; la = -0.35 + c * 0.25; ra = 0.35 - c * 0.25; bob = Math.abs(Math.sin(t * 4.5)) * 0.03; }
    if (pose === "cheer") { la = 2.6 + Math.sin(t * 6) * 0.2; ra = -2.6 - Math.sin(t * 6 + 1) * 0.2; bob = Math.abs(Math.sin(t * 5)) * 0.07; }
    if (pose === "trophy") { la = 2.75; ra = -2.75; lx = -0.15; rx = -0.15; bob = Math.abs(Math.sin(t * 3)) * 0.03; }
    if (pose === "walk") { legSwing = Math.sin(t * 8) * 0.5; lx = -legSwing * 0.8; rx = legSwing * 0.8; bob = Math.abs(Math.sin(t * 8)) * 0.03; }
    a.rotation.set(lx, 0, la);
    b.rotation.set(rx, 0, ra);
    if (legL.current && legR.current) { legL.current.rotation.x = legSwing; legR.current.rotation.x = -legSwing; }
    root.current.position.y = bob;
    if (head.current) head.current.rotation.y = pose === "idle" ? Math.sin(t * 0.7) * 0.18 : 0;
  });

  const skin = look.skin;
  return (
    <group {...group}>
      <group ref={root}>
        {/* Legs: skin thigh + sock/shin, pivot at the hip */}
        {([[-0.1, legL], [0.1, legR]] as const).map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 0.78, 0]}>
            <Limb len={0.2} r={0.068} color={skin} position={[0, -0.12, 0]} rough={0.5} />
            <Limb len={0.3} r={0.06} color={kit.socks} position={[0, -0.47, 0]} />
            <group position={[-x, -0.78, 0]}><Shoe x={x} style={look.shoes} color={look.shoeColor} /></group>
          </group>
        ))}
        {/* Shorts */}
        <mesh position={[0, 0.79, 0]} castShadow>
          <cylinderGeometry args={[0.205, 0.225, 0.24, 28]} />
          <meshStandardMaterial color={kit.shorts} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.79, 0.001]}>
          <cylinderGeometry args={[0.2265, 0.2265, 0.03, 28, 1, true]} />
          <meshStandardMaterial color={kit.trim} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Torso with printed shirt */}
        <mesh geometry={torsoGeo} castShadow>
          <meshStandardMaterial map={shirtTex} roughness={0.62} />
        </mesh>
        {/* Neck + head */}
        <Limb len={0.06} r={0.062} color={skin} position={[0, 1.44, 0]} rough={0.5} />
        <group ref={head} position={[0, 1.64, 0]}>
          <mesh geometry={headGeo} scale={[0.96, 1.06, 1]} castShadow>
            <meshStandardMaterial color={skin} roughness={0.48} />
          </mesh>
          {[-0.055, 0.055].map((x) => (
            <mesh key={x} geometry={sphereGeo} scale={[0.022, 0.028, 0.012]} position={[x, 0.02, 0.158]}>
              <meshStandardMaterial color="#111111" roughness={0.2} />
            </mesh>
          ))}
          {high && (
            <>
              {[-0.055, 0.055].map((x) => (
                <mesh key={x} position={[x, 0.07, 0.155]} rotation-z={x > 0 ? -0.12 : 0.12}>
                  <boxGeometry args={[0.055, 0.012, 0.012]} />
                  <meshStandardMaterial color={look.hair === "bald" ? "#2a1a10" : look.hairColor} roughness={0.8} />
                </mesh>
              ))}
              <mesh geometry={sphereGeo} scale={[0.022, 0.03, 0.025]} position={[0, -0.02, 0.17]}>
                <meshStandardMaterial color={skin} roughness={0.5} />
              </mesh>
              <mesh position={[0, -0.075, 0.148]} rotation-z={Math.PI}>
                <torusGeometry args={[0.035, 0.007, 6, 16, Math.PI]} />
                <meshStandardMaterial color="#5a1f1f" roughness={0.5} />
              </mesh>
              {[-0.165, 0.165].map((x) => (
                <mesh key={x} geometry={sphereGeo} scale={[0.025, 0.04, 0.03]} position={[x, 0, 0]}>
                  <meshStandardMaterial color={skin} roughness={0.5} />
                </mesh>
              ))}
            </>
          )}
          <Hair style={look.hair} color={look.hairColor} detail={high} />
        </group>
        {/* Arms: pivot at the shoulder; sleeve in shirt colour, forearm + hand in skin */}
        {([[-1, armL], [1, armR]] as const).map(([s, ref]) => (
          <group key={s} ref={ref} position={[s * 0.25, 1.33, 0]}>
            <Limb len={0.14} r={0.07} color={kit.shirt} position={[s * 0.03, -0.1, 0]} />
            <mesh position={[s * 0.032, -0.2, 0]}>
              <cylinderGeometry args={[0.072, 0.072, 0.025, 16]} />
              <meshStandardMaterial color={kit.trim} roughness={0.6} />
            </mesh>
            <Limb len={0.26} r={0.05} color={skin} position={[s * 0.035, -0.37, 0]} rough={0.5} />
            {high && <mesh geometry={sphereGeo} scale={0.058} position={[s * 0.035, -0.56, 0]}><meshStandardMaterial color={skin} roughness={0.5} /></mesh>}
          </group>
        ))}
        {pose === "trophy" && <GoldenBall position={[0, 2.38, 0.05]} scale={0.55} />}
      </group>
    </group>
  );
}

let ballTex: THREE.CanvasTexture | null = null;
/** Gold ball skin: soft panel seams so the trophy reads as a football. */
function goldBallTexture() {
  if (ballTex) return ballTex;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#fff1b0"); grad.addColorStop(0.5, "#e8b830"); grad.addColorStop(1, "#a8761a");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(90,55,5,0.55)"; g.lineWidth = 3;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    const cx = col * 64 + (row % 2) * 32 + 16, cy = row * 64 + 32;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); }
    g.closePath(); g.stroke();
  }
  ballTex = new THREE.CanvasTexture(c);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  return ballTex;
}

/** The Ballon d'Or trophy: gold ball on a black plinth with a gold band. Origin at the plinth base. */
export function GoldenBall(props: JSX.IntrinsicElements["group"]) {
  const tex = useMemo(() => goldBallTexture(), []);
  return (
    <group {...props}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 24]} />
        <meshStandardMaterial color="#141414" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.135, 0.135, 0.03, 24]} />
        <meshStandardMaterial color="#e8b830" roughness={0.25} metalness={1} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <sphereGeometry args={[0.2, 40, 28]} />
        <meshStandardMaterial map={tex} color="#ffd75e" roughness={0.18} metalness={1} emissive="#7a4e00" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/**
 * Glass trophy cabinet: every Ballon d'Or the player won stands on its shelves (12 visible, the rest counted).
 * Origin at the floor centre; the cabinet faces +z.
 */
export function TrophyCase({ count, ...group }: { count: number } & JSX.IntrinsicElements["group"]) {
  const W = 1.7, H = 2.3, D = 0.5;
  const shelves = [0.55, 1.15, 1.75];
  const shown = Math.min(count, 12);
  const frame = <meshStandardMaterial color="#1a1a1f" roughness={0.35} metalness={0.8} />;
  return (
    <group {...group}>
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <boxGeometry args={[W, H, 0.04]} />
        <meshStandardMaterial color="#0c0b10" roughness={0.6} />
      </mesh>
      {[-W / 2, W / 2].map((x) => (
        <mesh key={x} position={[x, H / 2, 0]}><boxGeometry args={[0.06, H, D]} />{frame}</mesh>
      ))}
      <mesh position={[0, H, 0]}><boxGeometry args={[W + 0.06, 0.08, D]} />{frame}</mesh>
      <mesh position={[0, 0.06, 0]}><boxGeometry args={[W + 0.06, 0.12, D]} />{frame}</mesh>
      {/* Pink LED strip under the roof */}
      <mesh position={[0, H - 0.05, D / 2 - 0.04]}>
        <boxGeometry args={[W - 0.1, 0.015, 0.015]} />
        <meshStandardMaterial color="#ff2d87" emissive="#ff2d87" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, H - 0.25, 0.15]} intensity={1.2} distance={2.6} color="#ffd9ec" />
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[W - 0.06, 0.02, D - 0.04]} />
          <meshStandardMaterial color="#cfe8ff" transparent opacity={0.35} roughness={0.05} metalness={0.2} />
        </mesh>
      ))}
      {Array.from({ length: shown }, (_, i) => {
        const shelf = Math.floor(i / 4), slot = i % 4;
        return <GoldenBall key={i} position={[(slot - 1.5) * 0.38, shelves[shelf] + 0.01, 0]} scale={0.62} />;
      })}
      {/* Glass front */}
      <mesh position={[0, H / 2, D / 2]}>
        <planeGeometry args={[W - 0.06, H - 0.1]} />
        <meshStandardMaterial color="#e6f2ff" transparent opacity={0.08} roughness={0.02} metalness={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

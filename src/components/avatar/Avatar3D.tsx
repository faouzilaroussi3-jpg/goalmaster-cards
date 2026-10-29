import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);

/** Deterministic pseudo-random so audience avatars sway out of sync without Math.random at render. */
function seeded(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return (h % 1000) / 1000;
}

function Limb({ len, r, color, position, rough = 0.6 }: { len: number; r: number; color: string; position: [number, number, number]; rough?: number }) {
  return (
    <mesh position={position} castShadow>
      <capsuleGeometry args={[r, len, 6, 14]} />
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
            return <mesh key={i} position={[Math.cos(a) * 0.16, -0.08, -Math.sin(a) * 0.15]}><capsuleGeometry args={[0.022, 0.16, 4, 8]} />{mat}</mesh>;
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
}: { look: AvatarLook; pose?: AvatarPose; detail?: "high" | "low"; seed?: string } & ThreeElements["group"]) {
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
    let la = -0.14, ra = 0.14, lx = 0, rx = 0, bob = Math.sin(t * 2) * 0.008, legSwing = 0;
    if (pose === "idle") { la -= Math.sin(t * 1.6) * 0.04; ra += Math.sin(t * 1.6) * 0.04; lx = Math.sin(t * 1.1) * 0.06; rx = -lx; }
    if (pose === "clap") { const c = Math.abs(Math.sin(t * 9)); lx = -1.2; rx = -1.2; la = 0.12 + c * 0.32; ra = -la; bob = Math.abs(Math.sin(t * 4.5)) * 0.03; }
    if (pose === "cheer") { la = -2.6 - Math.sin(t * 6) * 0.2; ra = 2.6 + Math.sin(t * 6 + 1) * 0.2; bob = Math.abs(Math.sin(t * 5)) * 0.07; }
    if (pose === "trophy") { la = -2.75; ra = 2.75; lx = -0.15; rx = -0.15; bob = Math.abs(Math.sin(t * 3)) * 0.03; }
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
            <Limb len={0.26} r={0.06} color={kit.socks} position={[0, -0.45, 0]} />
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

/* ---------------- Ballon d'Or trophy ---------------- */

const BALL_R = 0.19;
const BALL_Y = 0.37;

let seamGeo: THREE.BufferGeometry | null = null;
/**
 * Raised seams of a classic football (truncated icosahedron: 12 pentagons, 20 hexagons),
 * every edge bent onto the sphere and merged into one mesh (a single draw call).
 */
function ballSeams() {
  if (seamGeo) return seamGeo;
  const phi = (1 + Math.sqrt(5)) / 2;
  const base: [number, number, number][] = [
    [0, 1, 3 * phi],
    [1, 2 + phi, 2 * phi],
    [phi, 2, 2 * phi + 1],
  ];
  const verts: THREE.Vector3[] = [];
  const seen = new Set<string>();
  for (const [a, b, c] of base) {
    for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
      for (const sx of x ? [1, -1] : [1]) for (const sy of y ? [1, -1] : [1]) for (const sz of z ? [1, -1] : [1]) {
        const v = new THREE.Vector3(x * sx, y * sy, z * sz);
        const key = v.toArray().map((n) => n.toFixed(3)).join(",");
        if (!seen.has(key)) { seen.add(key); verts.push(v); }
      }
    }
  }
  const r = BALL_R * 1.004;
  const parts: THREE.BufferGeometry[] = [];
  verts.forEach((vi, i) => verts.slice(i + 1).forEach((vj) => {
    if (Math.abs(vi.distanceTo(vj) - 2) > 0.01) return;
    const a = vi.clone().normalize(), b = vj.clone().normalize();
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) pts.push(a.clone().lerp(b, k / 6).normalize().multiplyScalar(r));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, BALL_R * 0.022, 5, false));
  }));
  seamGeo = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return seamGeo;
}

let bandTex: THREE.CanvasTexture | null = null;
/** Engraved "BALLON D'OR" band wrapped round the plinth: lettering is cut darker into brushed gold. */
function engravedBand() {
  if (bandTex) return bandTex;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#ffe9a0"); grad.addColorStop(0.45, "#e2ad2c"); grad.addColorStop(1, "#9c6a12");
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 128);
  // brushed-metal streaks
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 1024, Math.random() * 128, 40 + Math.random() * 120, 1);
  }
  g.font = "bold 64px Georgia, 'Times New Roman', serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const x of [256, 768]) {
    // light edge below + dark cut = engraved look
    g.fillStyle = "rgba(255,240,190,0.7)"; g.fillText("BALLON D'OR", x, 68);
    g.fillStyle = "#5a3a06"; g.fillText("BALLON D'OR", x, 65);
  }
  g.fillStyle = "#5a3a06";
  g.fillRect(0, 8, 1024, 3); g.fillRect(0, 117, 1024, 3);
  bandTex = new THREE.CanvasTexture(c);
  bandTex.colorSpace = THREE.SRGBColorSpace;
  bandTex.anisotropy = 4;
  return bandTex;
}

/** Cradle that holds the ball on top of the plinth (lathe profile). */
const CRADLE_POINTS = [
  [0.0, 0], [0.105, 0], [0.11, 0.01], [0.085, 0.03], [0.07, 0.05], [0.085, 0.07], [0.0, 0.07],
].map(([x, y]) => new THREE.Vector2(x, y));

/**
 * The Ballon d'Or trophy: gold ball with raised football seams, held by a gold cradle on a
 * two-tier black plinth with an engraved gold band. Origin at the plinth base.
 */
export function GoldenBall(props: ThreeElements["group"]) {
  const seams = useMemo(() => ballSeams(), []);
  const band = useMemo(() => engravedBand(), []);
  const gold = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#f4c542", metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.12, emissive: "#6b4300", emissiveIntensity: 0.18 }),
    [],
  );
  const seamGold = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c58f1c", metalness: 1, roughness: 0.32 }),
    [],
  );
  const black = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#0d0d0f", metalness: 0.2, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    [],
  );
  return (
    <group {...props}>
      {/* lower tier: polished black */}
      <mesh position={[0, 0.035, 0]} material={black} castShadow receiveShadow>
        <cylinderGeometry args={[0.165, 0.18, 0.07, 40]} />
      </mesh>
      <mesh position={[0, 0.074, 0]} material={gold}>
        <cylinderGeometry args={[0.168, 0.168, 0.01, 40]} />
      </mesh>
      {/* upper tier: engraved band */}
      <mesh position={[0, 0.108, 0]} castShadow>
        <cylinderGeometry args={[0.138, 0.15, 0.058, 48, 1, true]} />
        <meshPhysicalMaterial map={band} bumpMap={band} bumpScale={-1.5} metalness={1} roughness={0.22} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, 0.139, 0]} material={black}>
        <cylinderGeometry args={[0.12, 0.138, 0.008, 40]} />
      </mesh>
      {/* gold cradle */}
      <mesh position={[0, 0.142, 0]} material={gold} castShadow>
        <latheGeometry args={[CRADLE_POINTS, 40]} />
      </mesh>
      {/* the ball */}
      <group position={[0, BALL_Y, 0]} rotation={[0.35, 0.6, 0.1]}>
        <mesh material={gold} castShadow>
          <sphereGeometry args={[BALL_R, 64, 48]} />
        </mesh>
        <mesh geometry={seams} material={seamGold} />
      </group>
    </group>
  );
}

/**
 * Glass trophy cabinet: every Ballon d'Or the player won stands on its shelves (12 visible, the rest counted).
 * Origin at the floor centre; the cabinet faces +z.
 */
export function TrophyCase({ count, ...group }: { count: number } & ThreeElements["group"]) {
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
        return <GoldenBall key={i} position={[(slot - 1.5) * 0.38, (shelves[shelf] ?? 0) + 0.01, 0]} scale={0.62} />;
      })}
      {/* Glass front */}
      <mesh position={[0, H / 2, D / 2]}>
        <planeGeometry args={[W - 0.06, H - 0.1]} />
        <meshStandardMaterial color="#e6f2ff" transparent opacity={0.08} roughness={0.02} metalness={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

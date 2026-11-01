import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AvatarLook } from "@/lib/avatar";
import { inkOn, kitFor, type Kit } from "@/lib/kits";
import type { TrophyKind } from "@/lib/ballon-dor";
import { DEFAULT_DESIGNS, FINISH_ROUGHNESS, type TrophyDesign } from "@/lib/trophy-design";
import { useTrophyDesign } from "@/lib/ballon-dor-query";

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
  look, pose = "idle", detail = "high", seed = "", held = "ballon", ...group
}: { look: AvatarLook; pose?: AvatarPose; detail?: "high" | "low"; seed?: string; held?: TrophyKind } & ThreeElements["group"]) {
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
        {pose === "trophy" && <TrophyModel kind={held} position={[0, 2.38, 0.05]} scale={0.55} />}
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

/** A colour moved toward another (t = 0 keeps it, 1 reaches the target), as a #hex string. */
function shade(hex: string, toward: string, t: number) {
  return "#" + new THREE.Color(hex).lerp(new THREE.Color(toward), t).getHexString();
}

const bandCache = new Map<string, THREE.CanvasTexture>();
/**
 * Engraved band wrapped round a plinth tier: lettering cut darker into brushed metal of the trophy's colour.
 * `aspect` is the band's circumference / height so letters are not stretched; the text appears twice, one centred on the front.
 */
function engravedBand(text: string, metal: string, aspect: number) {
  const key = `${text}|${metal}|${aspect.toFixed(1)}`;
  const hit = bandCache.get(key);
  if (hit) return hit;
  const W = 2048, H = Math.max(64, Math.round(W / aspect));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shade(metal, "#ffffff", 0.5)); grad.addColorStop(0.45, metal); grad.addColorStop(1, shade(metal, "#000000", 0.4));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // brushed-metal streaks
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * W, Math.random() * H, 60 + Math.random() * 200, 1);
  }
  const cut = shade(metal, "#000000", 0.66);
  if (text) {
    g.font = `bold ${Math.round(H * 0.44)}px Georgia, 'Times New Roman', serif`;
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(H * 0.08)}px`;
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const x of [W / 4, (3 * W) / 4]) {
      // light edge below + dark cut = engraved look
      g.fillStyle = shade(metal, "#ffffff", 0.6); g.globalAlpha = 0.7; g.fillText(text, x, H * 0.53);
      g.globalAlpha = 1; g.fillStyle = cut; g.fillText(text, x, H * 0.5);
    }
  }
  g.fillStyle = cut;
  const line = Math.max(2, Math.round(H * 0.025));
  g.fillRect(0, H * 0.06, W, line); g.fillRect(0, H * 0.94 - line, W, line);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.offset.x = 0.25;
  bandCache.set(key, tex);
  return tex;
}

/** Cradle that holds the ball on top of the plinth (lathe profile). */
const CRADLE_POINTS = [
  [0.0, 0], [0.105, 0], [0.11, 0.01], [0.085, 0.03], [0.07, 0.05], [0.085, 0.07], [0.0, 0.07],
].map(([x, y]) => new THREE.Vector2(x, y));

/** Diamond stalactites hang from the metal lip round the lower tier (lip radius, ring of crystals, top y). */
const LIP_R = 0.19;
const ICICLE_R = 0.184;
const ICICLE_TOP = 0.07;
const ICICLE_COUNT = 34;

/** Seeded 0..1 noise so every trophy grows the same crystals. */
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const icicleCache = new Map<number, { geo: THREE.BufferGeometry; tips: Float32Array }>();
/**
 * Faceted diamond stalactites round a plinth of ring radius `ringR`: each is a low-sided lathe (crisp facets,
 * flat normals) with a short crown and a long tapering point, slightly leaning and twisted,
 * long and short ones alternating. Merged into one mesh so the ring is a single draw call.
 */
function diamondIcicles(ringR = ICICLE_R) {
  const hit = icicleCache.get(ringR);
  if (hit) return hit;
  const count = Math.max(12, Math.round((ICICLE_COUNT * ringR) / ICICLE_R / 2) * 2);
  const parts: THREE.BufferGeometry[] = [];
  const tips: number[] = [];
  for (let i = 0; i < count; i++) {
    const long = i % 2 === 0;
    const L = long ? 0.034 + rnd(i) * 0.022 : 0.014 + rnd(i) * 0.014;
    const r = (long ? 0.0075 : 0.0055) + rnd(i + 50) * 0.002;
    const sides = 8 + (i % 3) * 2;
    const prof = [
      [0, 0.0015], [r * 0.8, 0.0015], [r, -0.0025], [r * 0.95, -L * 0.12], [r * 0.78, -L * 0.3], [r * 0.5, -L * 0.55], [r * 0.24, -L * 0.8], [0, -L],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    let g: THREE.BufferGeometry = new THREE.LatheGeometry(prof, sides);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    const a = (i / count) * Math.PI * 2 + (rnd(i + 9) - 0.5) * 0.06;
    const m = new THREE.Matrix4()
      .makeTranslation(Math.sin(a) * ringR, ICICLE_TOP, Math.cos(a) * ringR)
      .multiply(new THREE.Matrix4().makeRotationY(a))
      .multiply(new THREE.Matrix4().makeRotationX(-0.06 - rnd(i + 3) * 0.08)) // lean outward
      .multiply(new THREE.Matrix4().makeRotationY(rnd(i + 21) * Math.PI)); // twist facets
    g.applyMatrix4(m);
    parts.push(g);
    if (long) tips.push(...new THREE.Vector3(0, -L * 0.85, 0).applyMatrix4(m).toArray());
  }
  const out = { geo: mergeGeometries(parts) ?? new THREE.BufferGeometry(), tips: new Float32Array(tips) };
  parts.forEach((p) => p.dispose());
  icicleCache.set(ringR, out);
  return out;
}

const diamondCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** Diamond (or coloured gem): mirror-bright facets over partial transmission (a fully clear crystal only shows the plinth behind it), diamond IOR 2.42, dispersion and iridescence for rainbow fire. */
function diamondMaterial(gem = "#ffffff") {
  const key = gem.toLowerCase();
  const hit = diamondCache.get(key);
  if (hit) return hit;
  const white = key === "#ffffff";
  const mat = new THREE.MeshPhysicalMaterial({
    color: gem,
    metalness: 0.35,
    roughness: 0,
    transmission: 0.6,
    thickness: 0.03,
    ior: 2.42,
    dispersion: 4,
    iridescence: white ? 1 : 0.5,
    iridescenceThicknessRange: [180, 650],
    iridescenceIOR: 1.6,
    specularIntensity: 1,
    specularColor: new THREE.Color("#ffffff"),
    clearcoat: 1,
    clearcoatRoughness: 0,
    emissive: new THREE.Color(white ? "#d8efff" : gem),
    emissiveIntensity: white ? 0.07 : 0.18,
    envMapIntensity: 3.5,
    attenuationColor: new THREE.Color(white ? "#eaf6ff" : gem),
    attenuationDistance: 0.5,
  });
  diamondCache.set(key, mat);
  return mat;
}

let glintTex: THREE.CanvasTexture | null = null;
/** Four-point star sprite for the sparkles that twinkle on the crystal tips. */
function glintTexture() {
  if (glintTex) return glintTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.15, "rgba(230,245,255,0.8)"); rg.addColorStop(0.4, "rgba(200,230,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.beginPath(); g.moveTo(32, 0); g.lineTo(34, 30); g.lineTo(64, 32); g.lineTo(34, 34); g.lineTo(32, 64); g.lineTo(30, 34); g.lineTo(0, 32); g.lineTo(30, 30); g.closePath(); g.fill();
  glintTex = new THREE.CanvasTexture(c);
  return glintTex;
}

/** Diamond stalactites + twinkling glints (two draw calls per trophy). */
function DiamondIcicles({ ringR = ICICLE_R, gem = "#ffffff" }: { ringR?: number; gem?: string }) {
  const { geo, tips } = useMemo(() => diamondIcicles(ringR), [ringR]);
  const mat = useMemo(() => diamondMaterial(gem), [gem]);
  const glints = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(tips, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tips.length), 3));
    return g;
  }, [tips]);
  const glintMat = useMemo(
    () => new THREE.PointsMaterial({ map: glintTexture(), size: 0.035, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => () => { glints.dispose(); glintMat.dispose(); }, [glints, glintMat]);
  useFrame(({ clock }) => {
    const col = glints.getAttribute("color") as THREE.BufferAttribute;
    const t = reduced ? 0 : clock.elapsedTime;
    for (let i = 0; i < col.count; i++) {
      // each tip flashes briefly at its own rhythm
      const s = Math.max(0, Math.sin(t * (1.3 + rnd(i + 70) * 1.7) + i * 2.1)) ** 12;
      col.setXYZ(i, s, s, s);
    }
    col.needsUpdate = true;
  });
  return (
    <>
      <mesh geometry={geo} material={mat} castShadow />
      <points geometry={glints} material={glintMat} />
    </>
  );
}

/** Metal (from the design's colour + finish), plinth and seam materials of one trophy; disposed when the look changes. */
function useTrophyMaterials(d: TrophyDesign) {
  const mats = useMemo(() => {
    const rough = FINISH_ROUGHNESS[d.finish];
    return {
      metal: new THREE.MeshPhysicalMaterial({ color: d.metal, metalness: 1, roughness: rough, clearcoat: d.finish === "brosse" ? 0.15 : 0.6, clearcoatRoughness: 0.12, emissive: shade(d.metal, "#000000", 0.6), emissiveIntensity: 0.18 }),
      seam: new THREE.MeshStandardMaterial({ color: shade(d.metal, "#000000", 0.2), metalness: 1, roughness: Math.min(0.8, rough + 0.16) }),
      base: new THREE.MeshPhysicalMaterial({ color: d.base, metalness: 0.2, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    };
  }, [d.metal, d.base, d.finish]);
  useEffect(() => () => { mats.metal.dispose(); mats.seam.dispose(); mats.base.dispose(); }, [mats]);
  return mats;
}

/** Engraved metal band of radius r0 (top) → r1 (bottom) and height h; text-free when the inscription is empty. */
function EngravedBand({ text, metal, r0, r1, h, y }: { text: string; metal: string; r0: number; r1: number; h: number; y: number }) {
  const band = useMemo(() => engravedBand(text, metal, (Math.PI * (r0 + r1)) / h), [text, metal, r0, r1, h]);
  return (
    <mesh position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[r0, r1, h, 48, 1, true]} />
      <meshPhysicalMaterial map={band} bumpMap={band} bumpScale={-1.5} metalness={1} roughness={0.22} clearcoat={0.4} />
    </mesh>
  );
}

/**
 * The Ballon d'Or trophy: metal ball with raised football seams, held by a cradle on a
 * two-tier plinth with an engraved band and optional diamond stalactites. Origin at the plinth base.
 */
export function GoldenBall({ design = DEFAULT_DESIGNS.ballon, ...props }: { design?: TrophyDesign } & ThreeElements["group"]) {
  const seams = useMemo(() => ballSeams(), []);
  const { metal, seam, base } = useTrophyMaterials(design);
  return (
    <group {...props}>
      {/* lower tier */}
      <mesh position={[0, 0.035, 0]} material={base} castShadow receiveShadow>
        <cylinderGeometry args={[0.165, 0.18, 0.07, 40]} />
      </mesh>
      {/* metal lip the diamond stalactites hang from */}
      <mesh position={[0, 0.074, 0]} material={metal}>
        <cylinderGeometry args={[LIP_R, LIP_R, 0.01, 48]} />
      </mesh>
      {design.diamonds && <DiamondIcicles gem={design.gem} />}
      {/* upper tier: engraved band */}
      <EngravedBand text={design.inscription} metal={design.metal} r0={0.138} r1={0.15} h={0.058} y={0.108} />
      <mesh position={[0, 0.139, 0]} material={base}>
        <cylinderGeometry args={[0.12, 0.138, 0.008, 40]} />
      </mesh>
      {/* cradle */}
      <mesh position={[0, 0.142, 0]} material={metal} castShadow>
        <latheGeometry args={[CRADLE_POINTS, 40]} />
      </mesh>
      {/* the ball */}
      <group position={[0, BALL_Y, 0]} rotation={[0.35, 0.6, 0.1]}>
        <mesh material={metal} castShadow>
          <sphereGeometry args={[BALL_R, 64, 48]} />
        </mesh>
        <mesh geometry={seams} material={seam} />
      </group>
    </group>
  );
}

/** Cup profile (lathe): foot, stem, knot, then a wide bowl with a rolled lip folding back inside. */
const CUP_POINTS = [
  [0, 0], [0.075, 0], [0.078, 0.012], [0.045, 0.03], [0.022, 0.06], [0.03, 0.085], [0.022, 0.11], [0.03, 0.125],
  [0.07, 0.15], [0.105, 0.19], [0.122, 0.25], [0.128, 0.305], [0.136, 0.312], [0.12, 0.31], [0.112, 0.26], [0.095, 0.205], [0.05, 0.17], [0, 0.165],
].map(([x, y]) => new THREE.Vector2(x, y));

/** Top of the side trophies' plinth. */
const PLINTH_TOP = 0.118;

/** Two-tier plinth with a metal ring, shared by the side trophies: optional engraved band and diamond stalactites. */
function Plinth({ design, metal, base }: { design: TrophyDesign; metal: THREE.Material; base: THREE.Material }) {
  return (
    <>
      <mesh position={[0, 0.035, 0]} material={base} castShadow receiveShadow><cylinderGeometry args={[0.15, 0.165, 0.07, 40]} /></mesh>
      <mesh position={[0, 0.074, 0]} material={metal}><cylinderGeometry args={[0.158, 0.158, 0.01, 40]} /></mesh>
      {design.diamonds && <DiamondIcicles ringR={0.152} gem={design.gem} />}
      <mesh position={[0, 0.098, 0]} material={base}><cylinderGeometry args={[0.113, 0.128, 0.04, 40]} /></mesh>
      {design.inscription && <EngravedBand text={design.inscription} metal={design.metal} r0={0.1155} r1={0.1305} h={0.032} y={0.098} />}
    </>
  );
}

/**
 * Rarest-card trophy: an upright holographic card (accent colour) in a metal frame with a gem set in its
 * centre, on a stem over the plinth. Origin at the plinth base, about 0.5 tall.
 */
export function RareCardTrophy({ design = DEFAULT_DESIGNS.rarest_card, ...props }: { design?: TrophyDesign } & ThreeElements["group"]) {
  const { metal, base } = useTrophyMaterials(design);
  const holo = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: design.accent, metalness: 0.55, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 800], emissive: shade(design.accent, "#000000", 0.65), emissiveIntensity: 0.35 }),
    [design.accent],
  );
  useEffect(() => () => holo.dispose(), [holo]);
  const gem = useMemo(() => diamondMaterial(design.gem), [design.gem]);
  const W = 0.2, H = 0.29, F = 0.014;
  return (
    <group {...props}>
      <Plinth design={design} metal={metal} base={base} />
      <mesh position={[0, PLINTH_TOP + 0.025, 0]} material={metal} castShadow><cylinderGeometry args={[0.018, 0.035, 0.05, 24]} /></mesh>
      <group position={[0, PLINTH_TOP + 0.05 + H / 2, 0]} rotation={[0, 0.25, 0.04]}>
        <mesh material={holo} castShadow><boxGeometry args={[W, H, 0.012]} /></mesh>
        {/* metal frame */}
        {([[0, H / 2, W + F, F], [0, -H / 2, W + F, F], [W / 2, 0, F, H + F], [-W / 2, 0, F, H + F]] as const).map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0]} material={metal}><boxGeometry args={[w, h, 0.02]} /></mesh>
        ))}
        {/* inner metal line and the centre gem, on both faces */}
        {[1, -1].map((s) => (
          <group key={s} position={[0, 0, s * 0.008]} rotation-y={s > 0 ? 0 : Math.PI}>
            <mesh position={[0, 0.095, 0]} material={metal}><boxGeometry args={[W * 0.7, 0.006, 0.004]} /></mesh>
            <mesh position={[0, -0.095, 0]} material={metal}><boxGeometry args={[W * 0.7, 0.006, 0.004]} /></mesh>
            <mesh position={[0, 0, 0.012]} scale={[1, 1.3, 0.55]} material={gem}><octahedronGeometry args={[0.045, 0]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Most-matches-won trophy: a classic two-handled cup with a gem, on the plinth. Origin at the base, about 0.45 tall. */
export function WinsCup({ design = DEFAULT_DESIGNS.most_wins, ...props }: { design?: TrophyDesign } & ThreeElements["group"]) {
  const { metal, base } = useTrophyMaterials(design);
  // the lathe's outer and inner walls share one surface, so both sides must be lit
  const cupMetal = useMemo(() => Object.assign(metal.clone(), { side: THREE.DoubleSide, emissiveIntensity: 0.4 }), [metal]);
  useEffect(() => () => cupMetal.dispose(), [cupMetal]);
  const gem = useMemo(() => new THREE.MeshPhysicalMaterial({ color: design.gem, metalness: 0, roughness: 0, transmission: 0.5, thickness: 0.02, ior: 2, clearcoat: 1, emissive: design.gem, emissiveIntensity: 0.25 }), [design.gem]);
  useEffect(() => () => gem.dispose(), [gem]);
  return (
    <group {...props}>
      <Plinth design={design} metal={metal} base={base} />
      <group position={[0, PLINTH_TOP, 0]}>
        <mesh material={cupMetal} castShadow><latheGeometry args={[CUP_POINTS, 48]} /></mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * 0.112, 0.235, 0]} rotation-z={-s * Math.PI / 2} material={metal}>
            <torusGeometry args={[0.055, 0.011, 12, 28, Math.PI]} />
          </mesh>
        ))}
        <mesh position={[0, 0.24, 0.118]} rotation-x={-0.25} scale={[1, 1.25, 0.6]} material={gem}><octahedronGeometry args={[0.022, 0]} /></mesh>
      </group>
    </group>
  );
}

/** Any trophy of the ceremony by kind, in the look saved by the admin (or an explicit `design`, e.g. an unsaved preview). */
export function TrophyModel({ kind, design, ...group }: { kind: TrophyKind; design?: TrophyDesign } & ThreeElements["group"]) {
  const saved = useTrophyDesign(kind);
  const d = design ?? saved;
  if (kind === "rarest_card") return <RareCardTrophy design={d} {...group} />;
  if (kind === "most_wins") return <WinsCup design={d} {...group} />;
  return <GoldenBall design={d} {...group} />;
}

/**
 * Glass trophy cabinet: every Ballon d'Or the player won stands on its shelves, then the side trophies (12 visible, the rest counted).
 * Origin at the floor centre; the cabinet faces +z.
 */
export function TrophyCase({ count, others = [], ...group }: { count: number; others?: TrophyKind[] } & ThreeElements["group"]) {
  const W = 1.7, H = 2.3, D = 0.5;
  const shelves = [0.55, 1.15, 1.75];
  const items: TrophyKind[] = [...Array.from({ length: count }, () => "ballon" as const), ...others].slice(0, 12);
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
      {items.map((kind, i) => {
        const shelf = Math.floor(i / 4), slot = i % 4;
        return <TrophyModel key={i} kind={kind} position={[(slot - 1.5) * 0.38, (shelves[shelf] ?? 0) + 0.01, 0]} scale={0.62} />;
      })}
      {/* Glass front */}
      <mesh position={[0, H / 2, D / 2]}>
        <planeGeometry args={[W - 0.06, H - 0.1]} />
        <meshStandardMaterial color="#e6f2ff" transparent opacity={0.08} roughness={0.02} metalness={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

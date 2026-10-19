import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import dragonAsset from "@/assets/models/dragon-evolved.glb.asset.json";
import { DRAGON_PAD_X, DRAGON_PAD_Y } from "@/lib/dragon-orbit";
import { flightAngularSpeed, flightPoint, makeFlight } from "@/lib/dragon-flight";

// World units: the card is a 5x7 plane at the origin, facing the camera.
const CARD_W = 5;
const CARD_H = 7;
const VIEW_H = CARD_H * (1 + 2 * DRAGON_PAD_Y);
const CAM_Z = 16;
// Vertical FOV chosen so the z=0 plane maps exactly onto the card's DOM box.
const FOV = (2 * Math.atan(VIEW_H / 2 / CAM_Z) * 180) / Math.PI;

const DRAGON_LEN = 2.8;
const BANK = -0.5; // roll into turns; flips sign when the dragon turns back

// ---- Scale skin -------------------------------------------------------------------------------
// The model ships flat colours only, so the skin is a procedural overlapping-scale tile, projected
// triplanar in the mesh's bind-pose space so the scales stick to the body while it flaps.
let scaleTile: THREE.CanvasTexture | null = null;
function getScaleTile() {
  if (scaleTile) return scaleTile;
  const S = 256;
  const COLS = 8;
  const ROWS = 10;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "rgb(30,30,30)";
  g.fillRect(0, 0, S, S);
  const cw = S / COLS;
  const rh = S / ROWS;
  const r = cw * 0.62;
  for (let row = -1; row <= ROWS + 1; row++) {
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cw + (row % 2 ? cw / 2 : 0);
      const cy = row * rh;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < -r || x > S + r || y < -r || y > S + r) continue;
        const grad = g.createRadialGradient(x, y + r * 0.15, r * 0.05, x, y + r * 0.25, r);
        grad.addColorStop(0, "rgb(255,255,255)");
        grad.addColorStop(0.55, "rgb(170,170,170)");
        grad.addColorStop(1, "rgb(40,40,40)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI); // a "U" of scale hanging down; later rows overlap the previous
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.75)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r, 0.05, Math.PI - 0.05);
        g.stroke();
      }
    }
  }
  scaleTile = new THREE.CanvasTexture(cv);
  scaleTile.wrapS = scaleTile.wrapT = THREE.RepeatWrapping;
  scaleTile.colorSpace = THREE.NoColorSpace; // data, not colour
  scaleTile.anisotropy = 4;
  return scaleTile;
}

function scaleSkin(mat: THREE.MeshStandardMaterial, deep: THREE.Color, light: THREE.Color, freq: number) {
  mat.color.set(1, 1, 1);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uScales = { value: getScaleTile() };
    shader.uniforms.uDeep = { value: deep };
    shader.uniforms.uLight = { value: light };
    shader.uniforms.uFreq = { value: freq };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSkinPos;\nvarying vec3 vSkinN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSkinPos = position;\nvSkinN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vSkinPos;\nvarying vec3 vSkinN;\nuniform sampler2D uScales;\nuniform vec3 uDeep;\nuniform vec3 uLight;\nuniform float uFreq;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 bw = pow(abs(normalize(vSkinN)), vec3(4.0));
        bw /= (bw.x + bw.y + bw.z);
        vec3 sp = vSkinPos * uFreq;
        float scl = texture2D(uScales, sp.zy).r * bw.x + texture2D(uScales, sp.xz).r * bw.y + texture2D(uScales, sp.xy).r * bw.z;
        diffuseColor.rgb = mix(uDeep, uLight, scl);`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.2, 0.55, scl);");
  };
  mat.customProgramCacheKey = () => `dragon-scales-${freq}`;
}

function Dragon({ glow, ember, warm }: { glow: string; ember: string; warm: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(dragonAsset.url);

  const model = useMemo(() => {
    const o = SkeletonUtils.clone(scene);
    o.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds lag behind the animation
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        const fire = new THREE.Color(ember);
        const gold = new THREE.Color(glow);
        const light = new THREE.Color(warm);
        c.metalness = 0.2;
        c.roughness = 0.5;
        if (/Main/i.test(c.name)) {
          // Crimson armoured scales with molten highlights.
          scaleSkin(c, fire.clone().multiplyScalar(0.12), fire.clone().lerp(gold, 0.2), 70);
          c.emissive = fire.clone();
          c.emissiveIntensity = 0.12;
        } else if (/Secondary/i.test(c.name)) {
          // Belly and wing membranes: finer golden scales.
          scaleSkin(c, gold.clone().multiplyScalar(0.3), gold.clone().lerp(light, 0.35), 120);
          c.emissive = gold.clone();
          c.emissiveIntensity = 0.1;
        } else if (/Horn/i.test(c.name)) {
          c.color = light.clone().lerp(new THREE.Color(0.35, 0.3, 0.25), 0.45); // bone ivory
          c.roughness = 0.35;
        } else if (/Eye_White/i.test(c.name)) {
          c.color = light.clone();
          c.emissive = gold.clone().lerp(light, 0.5); // glowing eyes
          c.emissiveIntensity = 1.6;
        }
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
    });
    // Normalize: longest horizontal side → DRAGON_LEN, centered on its own origin.
    // Skinned bounds depend on the bone matrices, so pose the skeleton before measuring.
    const measure = () => {
      o.updateMatrixWorld(true);
      o.traverse((n) => { const sm = n as THREE.SkinnedMesh; if (sm.isSkinnedMesh) { sm.skeleton.update(); sm.computeBoundingBox(); } });
      return new THREE.Box3().setFromObject(o);
    };
    const box = measure();
    const size = box.getSize(new THREE.Vector3());
    o.scale.setScalar(DRAGON_LEN / (Math.max(size.x, size.z) || 1));
    const centered = measure().getCenter(new THREE.Vector3());
    o.position.sub(centered);
    const pivot = new THREE.Group();
    pivot.add(o);
    return pivot;
  }, [scene, ember, glow, warm]);

  const { actions, names } = useAnimations(animations, group);
  useEffect(() => {
    const name = names.find((n) => /Fast_Flying/i.test(n)) ?? names.find((n) => /Fly/i.test(n)) ?? names[0];
    const action = name ? actions[name] : undefined;
    if (action) {
      action.reset().setEffectiveTimeScale(1 + Math.random() * 0.35).play();
      action.time = Math.random() * action.getClip().duration; // wings never flap in sync between cards
    }
    return () => { action?.stop(); };
  }, [actions, names]);

  // Each card gets its own random flight, so SU cards side by side never fly in sync.
  const flight = useMemo(() => makeFlight(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const bank = useRef(0);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    pos.fromArray(flightPoint(flight, t));
    ahead.fromArray(flightPoint(flight, t + 0.1));
    if (ahead.distanceToSquared(pos) < 1e-6) ahead.fromArray(flightPoint(flight, t + 0.3));
    g.position.copy(pos);
    g.lookAt(ahead); // the model's +Z (its nose) follows the flight path, dives included
    const target = BANK * THREE.MathUtils.clamp(flightAngularSpeed(flight, t) / flight.w, -1.2, 1.2);
    bank.current += (target - bank.current) * (1 - Math.exp(-6 * Math.min(delta, 0.05)));
    g.rotateZ(bank.current);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
      <pointLight color={glow} intensity={6} distance={7} decay={1.6} />
    </group>
  );
}

/** Transparent overlay scene: a real 3D dragon circling the Secret Ultimate card, hidden behind the card when it flies round the back. */
export default function Dragon3D({ glow, warm, ember }: { glow: string; warm: string; ember: string }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.1, far: 60 }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 10]} intensity={2.2} color={warm} />
      <directionalLight position={[-6, -3, -4]} intensity={1.2} color={glow} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 5]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.4} color={glow} position={[-5, -1, 2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
      </Environment>
      {/* Invisible card: writes depth only, so the dragon disappears behind the card. */}
      <mesh renderOrder={-1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        <Dragon glow={glow} ember={ember} warm={warm} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(dragonAsset.url);

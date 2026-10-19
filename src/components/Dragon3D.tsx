import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import dragonAsset from "@/assets/models/dragon-evolved.glb.asset.json";
import { DRAGON_PAD_X, DRAGON_PAD_Y } from "@/lib/dragon-orbit";

// World units: the card is a 5x7 plane at the origin, facing the camera.
const CARD_W = 5;
const CARD_H = 7;
const VIEW_H = CARD_H * (1 + 2 * DRAGON_PAD_Y);
const CAM_Z = 16;
// Vertical FOV chosen so the z=0 plane maps exactly onto the card's DOM box.
const FOV = (2 * Math.atan(VIEW_H / 2 / CAM_Z) * 180) / Math.PI;

const LAP_S = 6.5;
const RX = 3.9; // orbit half-width (card half-width is 2.5)
const RZ = 3; // orbit depth in front of / behind the card
const DRAGON_LEN = 3;
const BANK = -0.45; // roll into the (always left-handed) turn

/** Point on the 3D orbit at time t: swoops low in front of the card and high behind it. */
function orbit(t: number, out: THREE.Vector3) {
  const a = (t / LAP_S) * Math.PI * 2;
  return out.set(RX * Math.cos(a), -1.9 * Math.sin(a) + 0.6 * Math.sin(2 * a), RZ * Math.sin(a));
}

function Dragon({ glow }: { glow: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(dragonAsset.url);
  console.log('DRAGONDBG loaded', animations.length);

  const model = useMemo(() => {
    const o = SkeletonUtils.clone(scene);
    o.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds lag behind the animation
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (c.emissive) { c.emissive = new THREE.Color(glow); c.emissiveIntensity = 0.28; }
        c.roughness = 0.45;
        c.metalness = 0.15;
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
    });
    // Normalize: longest horizontal side → DRAGON_LEN, centered on its own origin.
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    o.scale.setScalar(DRAGON_LEN / (Math.max(size.x, size.z) || 1));
    const centered = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    o.position.sub(centered);
    const pivot = new THREE.Group();
    pivot.add(o);
    return pivot;
  }, [scene, glow]);

  const { actions, names } = useAnimations(animations, group);
  useEffect(() => {
    const name = names.find((n) => /Fast_Flying/i.test(n)) ?? names.find((n) => /Fly/i.test(n)) ?? names[0];
    const action = name ? actions[name] : undefined;
    action?.reset().setEffectiveTimeScale(1.15).play();
    return () => { action?.stop(); };
  }, [actions, names]);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    orbit(t, pos);
    orbit(t + 0.12, ahead);
    g.position.copy(pos);
    g.lookAt(ahead); // the model's +Z (its nose) follows the flight path
    g.rotateZ(BANK);
    (window as unknown as Record<string, unknown>).__dragonDbg = { p: g.position.toArray(), box: new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).toArray(), s: model.children[0]?.scale.x };
  });

  return (
    <group ref={group}>
      <primitive object={model} />
      <pointLight color={glow} intensity={6} distance={7} decay={1.6} />
    </group>
  );
}

/** Transparent overlay scene: a real 3D dragon circling the Secret Ultimate card, hidden behind the card when it flies round the back. */
export default function Dragon3D({ glow, warm }: { glow: string; warm: string }) {
  console.log('DRAGONDBG canvas');
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
        <Dragon glow={glow} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(dragonAsset.url);

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AnimationMixer, Box3, Vector3, Group, Mesh, Bone, MeshStandardMaterial } from "three";
import modelAsset from "@/assets/models/goalmaster-athlete.glb.asset.json";
import type { CinemaPalette } from "@/lib/cinematic-3d";

export function preloadAthlete() { useGLTF.preload(modelAsset.url); }

export function Athlete({ time, tier, palette, onReady }: { time: React.RefObject<number>; tier: number; palette: CinemaPalette; onReady: () => void }) {
  const source = useGLTF(modelAsset.url);
  const root = useRef<Group>(null);
  const model = useMemo(() => {
    const object = clone(source.scene); const box = new Box3().setFromObject(object); const size = box.getSize(new Vector3());
    object.scale.setScalar(2.3 / (size.y || 1));
    const scaled = new Box3().setFromObject(object); const center = scaled.getCenter(new Vector3());
    object.position.set(-center.x, -scaled.min.y - 1.15, -center.z);
    const material = new MeshStandardMaterial({ color: palette.player, roughness: .35, metalness: .45 });
    object.traverse((o) => { if (o instanceof Mesh) { o.material = material; o.castShadow = true; o.frustumCulled = false; } });
    return { object, material };
  }, [source.scene, palette]);
  const mixer = useMemo(() => new AnimationMixer(model.object), [model]);
  const bones = useMemo(() => {
    const map: Record<string, Bone> = {}; model.object.traverse((o) => { if (o instanceof Bone) map[o.name] = o; }); return map;
  }, [model]);
  useEffect(() => {
    const clip = source.animations.find((c) => c.name.includes("Run")); if (clip) mixer.clipAction(clip).play();
    onReady();
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(model.object); model.material.dispose(); };
  }, [source.animations, mixer, model, onReady]);
  useFrame((_, rawDelta) => {
    const p = time.current; const dt = Math.min(rawDelta, .05);
    if (p < .27) mixer.update(dt * 1.5);
    const hip = bones["Hips"]; const left = bones["LeftUpLeg"]; const right = bones["RightUpLeg"]; const knee = bones["RightLeg"];
    const leftArm = bones["LeftArm"]; const rightArm = bones["RightArm"];
    if (p >= .27) {
      const kick = Math.sin(Math.min(1, (p - .27) / .26) * Math.PI);
      if (left) left.rotation.x = .4 + kick * .5;
      if (right) right.rotation.x = -kick * 1.9;
      if (knee) knee.rotation.x = .3 + kick * .7;
      if (leftArm) leftArm.rotation.z = .7;
      if (rightArm) rightArm.rotation.z = -.7;
      if (hip) hip.rotation.x = tier >= 5 ? -.2 : -.1;
    }
    if (!root.current) return;
    const jump = tier >= 4 ? Math.sin(Math.min(1, Math.max(0, (p - .2) / .55)) * Math.PI) : 0;
    root.current.position.set(-1.8 + Math.min(p / .3, 1) * 1.8, 1.15 + jump * (tier >= 5 ? 1.9 : .9), 0);
    root.current.rotation.y = Math.PI + (tier >= 6 ? jump * .7 : 0);
    root.current.rotation.x = tier >= 5 ? -Math.min(1, Math.max(0, (p - .28) / .45)) * Math.PI * 2 : jump * -.3;
    root.current.rotation.z = tier >= 5 ? jump * .35 : 0;
  });
  return <group ref={root}><primitive object={model.object} /></group>;
}
useGLTF.preload(modelAsset.url);
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seatPosition } from "@/lib/ballon-dor";
import { CEILING_Y, HALL_BACK, HALL_HALF_W, HOST_XZ, PEDESTALS, STAGE_BACK, STAGE_FRONT, STAGE_HALF_W, STAGE_Y, WINNER_XZ } from "./ceremony-layout";
import { carpetTexture, cofferTexture, damaskTexture, fasciaTexture, glowTexture, marbleTexture, screenTexture, sheenTexture, stageFloorTexture, washTexture } from "./hall-textures";

/*
 * Ballon d'Or gala hall, fully procedural. Static parts sharing a material are merged into one geometry
 * (gold, lacquer, neon, walls…) and repeated parts are instanced (chairs, crystals, roses, moving heads),
 * so the whole room stays around 40 draw calls next to the avatars.
 */

type V3 = [number, number, number];
const SEATS_PER_ROW = 8;

function at<G extends THREE.BufferGeometry>(g: G, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): G {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  return g;
}
const box = (w: number, h: number, d: number, p: V3, r?: V3) => at(new THREE.BoxGeometry(w, h, d), p, r);
const cyl = (rt: number, rb: number, h: number, p: V3, seg = 16, r?: V3) => at(new THREE.CylinderGeometry(rt, rb, h, seg), p, r);
const torus = (R: number, t: number, p: V3, r?: V3, arc = Math.PI * 2, seg = 48) => at(new THREE.TorusGeometry(R, t, 8, seg, arc), p, r);
const ball = (rad: number, p: V3, s?: V3) => at(new THREE.SphereGeometry(rad, 14, 10), p, undefined, s);
const lathe = (pts: [number, number][], p: V3, seg = 28) => at(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), p);
const plane = (w: number, h: number, p: V3, r?: V3, uvMetres?: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  if (uvMetres) { const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / uvMetres, (uv.getY(i) * h) / uvMetres); }
  return at(g, p, r);
};
const tube = (pts: V3[], radius: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), Math.max(8, pts.length * 4), radius, 6, false);
/** Bar from a to b (cylinder). */
function bar(a: V3, b: V3, r: number) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
function merge(parts: THREE.BufferGeometry[]) {
  const clean = parts.map((p) => (p.index ? p : p)).map((p) => { for (const k of Object.keys(p.attributes)) if (!["position", "normal", "uv"].includes(k)) p.deleteAttribute(k); return p; });
  const g = mergeGeometries(clean) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return g;
}
const transform = (parts: THREE.BufferGeometry[], p: V3, r: V3) => parts.map((g) => at(g, p, r));

const CHANDELIERS: V3[] = [[-3.4, 0, 2.2], [3.4, 0, 2.2], [-3.4, 0, 10.4], [3.4, 0, 10.4]];
const CH_RINGS: { R: number; y: number }[] = [{ R: 0.62, y: 6.25 }, { R: 0.42, y: 5.95 }, { R: 0.22, y: 5.7 }];
const COLUMN_Z = [-0.2, 3.4, 7, 10.6];
const PANEL_Z = [1.6, 5.2, 8.8];
const HEADS_X = [-4, -2.4, -0.8, 0.8, 2.4, 4];
const HEAD_Y = 5.75, HEAD_Z = -0.42;
const URNS: V3[] = [[-3.3, 0, -0.95], [3.3, 0, -0.95]];
const POSTS_Z = [-0.6, 0.8, 2.2];
const TV_CAM: { p: V3; yaw: number } = { p: [6.4, 0, 1.2], yaw: 1.107 };

/** Folded velvet curtain hanging from y0 to y1, gathered towards its outer edge around the tie-back. */
function curtainGeometry(width: number, y0: number, y1: number) {
  const g = new THREE.PlaneGeometry(width, y1 - y0, 48, 24);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / width + 0.5; // 0 = outer edge, 1 = inner edge
    const y = pos.getY(i) + (y1 + y0) / 2;
    const gather = Math.exp(-(((y - 2.4) / 1.4) ** 2));
    const x = u * width * (1 - 0.45 * gather);
    const z = 0.09 * Math.sin(u * Math.PI * 11) * (0.6 + 0.4 * gather) + 0.12 * gather * u;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Scalloped swags across the top of the stage opening. Returns the cloth and the gold fringe line under it. */
function valanceGeometry(width: number, top: number, swags: number) {
  const g = new THREE.PlaneGeometry(width, 1, 160, 10);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const bottom: V3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const v = pos.getY(i) + 0.5; // 1 = top
    const s = 0.5 - 0.5 * Math.cos(((x / width + 0.5) * swags) * Math.PI * 2);
    const drop = 0.28 + 0.42 * s;
    const y = top - (1 - v) * drop;
    const z = 0.16 * s * Math.sin((1 - v) * Math.PI * 0.9) + 0.025 * Math.sin(v * Math.PI * 7);
    pos.setXYZ(i, x, y, z);
    if (v === 0 && i % 2 === 0) bottom.push([x, y - 0.01, z + 0.01]);
  }
  g.computeVertexNormals();
  bottom.sort((a, b) => a[0] - b[0]);
  return { cloth: g, fringe: tube(bottom, 0.025) };
}

function useHallAssets(rows: number) {
  const tex = useMemo(() => {
    const t = {
      marble: marbleTexture(), carpet: carpetTexture(), fascia: fasciaTexture(), screen: screenTexture(), sheen: sheenTexture(),
      stage: stageFloorTexture(), damask: damaskTexture(), coffer: cofferTexture(), glow: glowTexture(), wash: washTexture(),
    };
    t.marble.repeat.set(6, 6);
    t.carpet.repeat.set(1, 4);
    return t;
  }, []);

  const mats = useMemo(() => ({
    gold: new THREE.MeshStandardMaterial({ color: "#d9a441", metalness: 1, roughness: 0.26, envMapIntensity: 1.6 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: "#ffd75e", emissive: "#c8901a", emissiveIntensity: 1.6, metalness: 1, roughness: 0.2 }),
    lacquer: new THREE.MeshStandardMaterial({ color: "#121016", metalness: 0.55, roughness: 0.22 }),
    neon: new THREE.MeshStandardMaterial({ color: "#ff2d87", emissive: "#ff2d87", emissiveIntensity: 2.4 }),
    steel: new THREE.MeshStandardMaterial({ color: "#8f9099", metalness: 1, roughness: 0.38 }),
    velvet: new THREE.MeshPhysicalMaterial({ color: "#8c0f45", roughness: 0.8, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color("#ff7ab6") }),
    curtain: new THREE.MeshPhysicalMaterial({ color: "#7a0b3b", roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color("#ff6aa8"), side: THREE.DoubleSide }),
    riser: new THREE.MeshStandardMaterial({ color: "#1c1520", roughness: 0.85 }),
    floor: new THREE.MeshStandardMaterial({ map: tex.marble, roughness: 0.16, metalness: 0.25, envMapIntensity: 1.2 }),
    carpet: new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 0.95, emissive: "#2a0414" }),
    fascia: new THREE.MeshStandardMaterial({ map: tex.fascia, emissiveMap: tex.fascia, emissive: "#ffffff", emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 }),
    stageTop: new THREE.MeshStandardMaterial({ map: tex.stage, roughness: 0.12, metalness: 0.35 }),
    screen: new THREE.MeshBasicMaterial({ map: tex.screen }),
    sheen: new THREE.MeshBasicMaterial({ map: tex.sheen, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    walls: new THREE.MeshStandardMaterial({ map: tex.damask, roughness: 0.85 }),
    ceiling: new THREE.MeshStandardMaterial({ map: tex.coffer, roughness: 0.8 }),
    crystal: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffe9c4", emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.04, envMapIntensity: 3, flatShading: true }),
    warm: new THREE.MeshBasicMaterial({ color: "#f3cf93" }),
    rose: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#1f4d2b", roughness: 0.7 }),
    beam: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    pool: new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    wash: new THREE.MeshBasicMaterial({ map: tex.wash, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowSmall: new THREE.PointsMaterial({ map: tex.glow, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }),
    glowBig: new THREE.PointsMaterial({ map: tex.glow, size: 0.75, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }),
  }), [tex]);

  /** Everything that never moves, merged per material. Rebuilt only when the number of audience rows changes. */
  const geo = useMemo(() => {
    const gold: THREE.BufferGeometry[] = [], goldGlow: THREE.BufferGeometry[] = [], lacquer: THREE.BufferGeometry[] = [];
    const neon: THREE.BufferGeometry[] = [], steel: THREE.BufferGeometry[] = [], risers: THREE.BufferGeometry[] = [];
    const warm: THREE.BufferGeometry[] = [], velvet: THREE.BufferGeometry[] = [], walls: THREE.BufferGeometry[] = [];
    const sy = STAGE_Y, depth = STAGE_FRONT - STAGE_BACK, sz = (STAGE_FRONT + STAGE_BACK) / 2;

    // Stage body, trims, LED line, steps, footlight domes
    lacquer.push(box(STAGE_HALF_W * 2, sy, depth, [0, sy / 2, sz]));
    gold.push(box(STAGE_HALF_W * 2 + 0.1, 0.05, 0.07, [0, sy, STAGE_FRONT]), box(STAGE_HALF_W * 2 + 0.1, 0.06, 0.05, [0, 0.03, STAGE_FRONT + 0.01]));
    neon.push(box(STAGE_HALF_W * 2, 0.03, 0.03, [0, sy - 0.075, STAGE_FRONT + 0.02]));
    for (let i = 0; i < 2; i++) {
      const h = (sy / 3) * (2 - i), zc = STAGE_FRONT + 0.15 + i * 0.3;
      lacquer.push(box(1.8, h, 0.3, [0, h / 2, zc]));
      gold.push(box(1.82, 0.025, 0.035, [0, h, zc + 0.15]));
      goldGlow.push(box(1.4, 0.015, 0.01, [0, h - 0.06, zc + 0.152]));
    }
    for (let x = -4.5; x <= 4.51; x += 1) if (Math.abs(x) > 1) goldGlow.push(at(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [x, sy, STAGE_FRONT - 0.12]));
    // Gold rings inlaid round the winner's spot (flush with the floor, so shoes never clip)
    gold.push(torus(0.92, 0.018, [WINNER_XZ[0], sy + 0.004, WINNER_XZ[1]], [Math.PI / 2, 0, 0], Math.PI * 2, 64));
    goldGlow.push(torus(0.6, 0.012, [WINNER_XZ[0], sy + 0.004, WINNER_XZ[1]], [Math.PI / 2, 0, 0], Math.PI * 2, 64));

    // Back wall, giant screen frame and ring
    lacquer.push(box(12.4, CEILING_Y, 0.1, [0, CEILING_Y / 2, STAGE_BACK - 0.12]));
    gold.push(box(8.6, 0.09, 0.07, [0, 5.44, STAGE_BACK + 0.03]), box(8.6, 0.09, 0.07, [0, 0.66, STAGE_BACK + 0.03]));
    gold.push(box(0.09, 4.86, 0.07, [-4.25, 3.05, STAGE_BACK + 0.03]), box(0.09, 4.86, 0.07, [4.25, 3.05, STAGE_BACK + 0.03]));
    goldGlow.push(torus(1.45, 0.06, [0, 3.2, STAGE_BACK + 0.1], undefined, Math.PI * 2, 96));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; goldGlow.push(ball(0.09, [Math.cos(a) * 1.45, 3.2 + Math.sin(a) * 1.45, STAGE_BACK + 0.12])); }

    // Proscenium arch: lacquer pillars with gold bases, flutes and capitals, a gold-trimmed beam and a crest
    const pz = -1.65;
    for (const sx of [-1, 1]) {
      const x = sx * 5.6;
      lacquer.push(box(0.56, 6.15, 0.56, [x, 3.375, pz]));
      gold.push(box(0.82, 0.3, 0.82, [x, 0.15, pz]), box(0.7, 0.06, 0.7, [x, 0.33, pz]), box(0.72, 0.12, 0.72, [x, 6.39, pz]));
      gold.push(box(0.04, 5.6, 0.02, [x - 0.15, 3.4, pz + 0.285]), box(0.04, 5.6, 0.02, [x + 0.15, 3.4, pz + 0.285]));
      neon.push(box(0.05, 5.4, 0.02, [x, 3.4, pz + 0.29]));
      // Wings between the arch and the side walls
      walls.push(plane(HALL_HALF_W - 5.88, CEILING_Y, [sx * (5.88 + (HALL_HALF_W - 5.88) / 2), CEILING_Y / 2, pz + 0.2], undefined, 3));
    }
    lacquer.push(box(12.4, 0.6, 0.62, [0, 6.75, pz]));
    gold.push(box(12.5, 0.05, 0.66, [0, 6.45, pz]), box(12.5, 0.05, 0.66, [0, 7.05, pz]), box(12.8, 0.12, 0.8, [0, 7.13, pz]));
    neon.push(box(12, 0.03, 0.02, [0, 6.75, pz + 0.32]));
    gold.push(torus(0.36, 0.04, [0, 7.2, pz + 0.38], undefined, Math.PI, 32), ball(0.12, [0, 7.44, pz + 0.38]));
    walls.push(plane(HALL_HALF_W * 2, CEILING_Y - 7.19, [0, (CEILING_Y + 7.19) / 2, pz + 0.21], undefined, 3));

    // Curtain tie-backs and tassels
    for (const sx of [-1, 1]) {
      gold.push(torus(0.13, 0.025, [sx * 5.05, 2.4, -1.66], [0, Math.PI / 2, 0], Math.PI * 2, 24));
      gold.push(cyl(0.015, 0.07, 0.32, [sx * 5.05, 2.1, -1.6], 10), ball(0.04, [sx * 5.05, 2.27, -1.6]));
    }

    // Lectern for the host: lacquer body, slanted gold-edged top, gold crest, microphone
    const lx = HOST_XZ[0] - 0.7, lz = HOST_XZ[1] + 0.1;
    lacquer.push(lathe([[0, 0], [0.26, 0], [0.26, 0.04], [0.16, 0.12], [0.13, 0.9], [0.2, 1.0], [0, 1.0]], [lx, sy, lz], 24));
    lacquer.push(box(0.6, 0.05, 0.42, [lx, sy + 1.05, lz], [0.35, 0, 0]));
    gold.push(box(0.62, 0.02, 0.44, [lx, sy + 1.08, lz], [0.35, 0, 0]));
    gold.push(torus(0.09, 0.015, [lx, sy + 0.7, lz + 0.15], undefined, Math.PI * 2, 24), ball(0.055, [lx, sy + 0.7, lz + 0.15]));
    gold.push(torus(0.24, 0.012, [lx, sy + 0.02, lz], [Math.PI / 2, 0, 0], Math.PI * 2, 32));
    steel.push(tube([[lx + 0.15, sy + 1.08, lz - 0.05], [lx + 0.2, sy + 1.28, lz + 0.02], [lx + 0.24, sy + 1.4, lz + 0.18]], 0.008));
    lacquer.push(ball(0.035, [lx + 0.245, sy + 1.42, lz + 0.21], [1, 1.3, 1]));

    // Trophy pedestals: lacquer column, gold bands, glowing top ring
    for (const p of PEDESTALS) {
      const y0 = sy, h = p.h;
      lacquer.push(lathe([[0, 0], [0.4, 0], [0.4, 0.06], [0.3, 0.12], [0.27, h - 0.1], [0.34, h - 0.04], [0.34, h], [0, h]], [p.x, y0, p.z], 32));
      gold.push(torus(0.4, 0.018, [p.x, y0 + 0.06, p.z], [Math.PI / 2, 0, 0], Math.PI * 2, 48), torus(0.275, 0.014, [p.x, y0 + 0.16, p.z], [Math.PI / 2, 0, 0], Math.PI * 2, 48));
      goldGlow.push(torus(0.34, 0.016, [p.x, y0 + h - 0.02, p.z], [Math.PI / 2, 0, 0], Math.PI * 2, 48));
    }

    // Side walls with wainscot rail, columns, framed panels and sconces; back wall with double doors
    const wallLen = HALL_BACK - STAGE_FRONT + 0.2, wallZ = (HALL_BACK + STAGE_FRONT - 0.2) / 2;
    for (const sx of [-1, 1]) {
      const wx = sx * HALL_HALF_W;
      walls.push(plane(wallLen, CEILING_Y, [wx, CEILING_Y / 2, wallZ], [0, -sx * Math.PI / 2, 0], 3));
      gold.push(box(0.04, 0.05, wallLen, [wx - sx * 0.02, 1.1, wallZ]), box(0.06, 0.1, wallLen, [wx - sx * 0.03, CEILING_Y - 0.06, wallZ]));
      for (const z of COLUMN_Z) {
        const x = sx * 8.62;
        lacquer.push(cyl(0.29, 0.31, 6.6, [x, 3.6, z], 20));
        gold.push(box(0.8, 0.36, 0.8, [x, 0.18, z]), cyl(0.38, 0.4, 0.12, [x, 0.42, z], 20), cyl(0.42, 0.3, 0.26, [x, 7.03, z], 20), box(0.92, 0.14, 0.92, [x, 7.23, z]));
      }
      for (const z of PANEL_Z) {
        const x = wx - sx * 0.025;
        gold.push(box(0.03, 0.04, 2.4, [x, 1.5, z]), box(0.03, 0.04, 2.4, [x, 6.6, z]), box(0.03, 5.14, 0.04, [x, 4.05, z - 1.2]), box(0.03, 5.14, 0.04, [x, 4.05, z + 1.2]));
        gold.push(box(0.04, 0.36, 0.18, [wx - sx * 0.03, 3.4, z]), bar([wx - sx * 0.04, 3.35, z], [wx - sx * 0.25, 3.5, z], 0.015));
        warm.push(ball(0.07, [wx - sx * 0.27, 3.58, z]));
      }
    }
    walls.push(plane(HALL_HALF_W * 2, CEILING_Y, [0, CEILING_Y / 2, HALL_BACK], [0, Math.PI, 0], 3));
    for (const sx of [-1, 1]) {
      lacquer.push(box(1.18, 3, 0.08, [sx * 0.61, 1.5, HALL_BACK - 0.05]));
      gold.push(box(0.06, 3.1, 0.1, [sx * 1.24, 1.55, HALL_BACK - 0.06]), cyl(0.018, 0.018, 0.5, [sx * 0.12, 1.45, HALL_BACK - 0.11], 8));
      gold.push(box(0.8, 0.03, 0.02, [sx * 0.61, 0.9, HALL_BACK - 0.1]), box(0.8, 0.03, 0.02, [sx * 0.61, 2.4, HALL_BACK - 0.1]));
    }
    gold.push(box(2.6, 0.08, 0.1, [0, 3.06, HALL_BACK - 0.06]));
    goldGlow.push(torus(1.25, 0.04, [0, 3.1, HALL_BACK - 0.08], [0, Math.PI, 0], Math.PI, 48));
    warm.push(at(new THREE.CircleGeometry(1.2, 32, 0, Math.PI), [0, 3.1, HALL_BACK - 0.07], [0, Math.PI, 0]));
    for (let k = 1; k < 8; k++) { const a = (k / 8) * Math.PI; gold.push(bar([0, 3.1, HALL_BACK - 0.09], [Math.cos(a) * 1.2, 3.1 + Math.sin(a) * 1.2, HALL_BACK - 0.09], 0.018)); }
    gold.push(torus(0.35, 0.02, [0, 3.1, HALL_BACK - 0.09], [0, Math.PI, 0], Math.PI, 24));

    // Carpet stanchions (gold posts, velvet ropes)
    for (const sx of [-1, 1]) {
      const x = sx * 0.9;
      for (const z of POSTS_Z) gold.push(cyl(0.12, 0.14, 0.04, [x, 0.02, z], 20), cyl(0.022, 0.022, 0.88, [x, 0.48, z], 10), ball(0.05, [x, 0.95, z]));
      for (let k = 0; k < POSTS_Z.length - 1; k++) {
        const z0 = POSTS_Z[k]!, z1 = POSTS_Z[k + 1]!;
        velvet.push(tube([[x, 0.88, z0], [x, 0.7, (z0 + z1) / 2 - 0.2], [x, 0.66, (z0 + z1) / 2], [x, 0.7, (z0 + z1) / 2 + 0.2], [x, 0.88, z1]], 0.022));
      }
    }

    // Flower urns either side of the steps
    for (const u of URNS) {
      lacquer.push(box(0.52, 0.46, 0.52, [u[0], 0.23, u[2]]));
      gold.push(box(0.56, 0.03, 0.56, [u[0], 0.47, u[2]]));
      gold.push(lathe([[0, 0], [0.12, 0], [0.14, 0.04], [0.08, 0.12], [0.1, 0.2], [0.22, 0.42], [0.27, 0.55], [0.22, 0.6], [0.26, 0.65], [0, 0.65]], [u[0], 0.48, u[2]], 28));
    }

    // Audience risers with gold nosing and pink step LEDs
    for (let r = 1; r < rows; r++) {
      const [, y, z] = seatPosition(r * SEATS_PER_ROW);
      risers.push(box(11.6, y, 1.5, [0.2, y / 2, z]));
      gold.push(box(11.7, 0.03, 0.05, [0.2, y, z - 0.75]));
      neon.push(box(11.4, 0.02, 0.012, [0.2, y - 0.07, z - 0.756]));
    }

    // Chandeliers: canopy, stem, vase body, three rings with arms, candle cups and candles
    for (const [cx, , cz] of CHANDELIERS) {
      gold.push(cyl(0.22, 0.16, 0.08, [cx, CEILING_Y - 0.04, cz], 20), cyl(0.018, 0.018, 1.25, [cx, 7.1, cz], 8));
      gold.push(lathe([[0, 0], [0.07, 0], [0.12, 0.12], [0.08, 0.3], [0.14, 0.55], [0.06, 0.75], [0.05, 0.9], [0, 0.9]], [cx, 5.6, cz], 20), ball(0.07, [cx, 5.55, cz]));
      CH_RINGS.forEach(({ R, y }, ri) => {
        gold.push(torus(R, 0.022, [cx, y, cz], [Math.PI / 2, 0, 0], Math.PI * 2, 48));
        const arms = ri === 0 ? 12 : 8;
        for (let k = 0; k < arms; k++) {
          const a = (k / arms) * Math.PI * 2 + ri * 0.2;
          const ex = cx + Math.cos(a) * R, ez = cz + Math.sin(a) * R;
          gold.push(bar([cx, y + 0.18, cz], [ex, y, ez], 0.01));
          if (ri === 0) {
            gold.push(cyl(0.03, 0.02, 0.04, [ex, y + 0.03, ez], 10));
            warm.push(cyl(0.012, 0.012, 0.09, [ex, y + 0.09, ez], 6));
          }
        }
      });
    }

    // Lighting truss above the stage front with hanging yokes
    const tx = 4.7, ty = 6.05, tz0 = -0.6, tz1 = -0.25, tzt = -0.42;
    steel.push(bar([-tx, ty, tz0], [tx, ty, tz0], 0.03), bar([-tx, ty, tz1], [tx, ty, tz1], 0.03), bar([-tx, ty + 0.3, tzt], [tx, ty + 0.3, tzt], 0.03));
    for (let x = -tx, k = 0; x < tx; x += 0.5, k++) {
      const z = k % 2 ? tz0 : tz1;
      steel.push(bar([x, ty, z], [x + 0.5, ty + 0.3, tzt], 0.012), bar([x, ty, tz0], [x, ty, tz1], 0.012));
    }
    for (const sx of [-1, 1]) steel.push(bar([sx * 4.2, ty + 0.3, tzt], [sx * 4.2, CEILING_Y, tzt], 0.008));
    for (const x of HEADS_X) steel.push(box(0.3, 0.04, 0.05, [x, ty - 0.06, tzt]), box(0.03, 0.26, 0.05, [x - 0.14, HEAD_Y + 0.08, tzt]), box(0.03, 0.26, 0.05, [x + 0.14, HEAD_Y + 0.08, tzt]));

    // TV camera on a tripod filming the stage
    {
      const s: THREE.BufferGeometry[] = [], l: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; s.push(bar([0, 1.15, 0], [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], 0.018)); }
      s.push(cyl(0.05, 0.05, 0.12, [0, 1.2, 0], 12), bar([0.05, 1.32, 0.2], [0.35, 1.1, 0.75], 0.012));
      l.push(box(0.3, 0.3, 0.56, [0, 1.42, 0]), cyl(0.09, 0.11, 0.3, [0, 1.42, -0.42], 16, [Math.PI / 2, 0, 0]), box(0.16, 0.12, 0.18, [0.16, 1.62, 0.12]));
      steel.push(...transform(s, TV_CAM.p, [0, TV_CAM.yaw, 0]));
      lacquer.push(...transform(l, TV_CAM.p, [0, TV_CAM.yaw, 0]));
    }

    return {
      gold: merge(gold), goldGlow: merge(goldGlow), lacquer: merge(lacquer), neon: merge(neon), steel: merge(steel),
      risers: risers.length ? merge(risers) : null, warm: merge(warm), velvet: merge(velvet), walls: merge(walls),
    };
  }, [rows]);

  /** Glowing light points: candles, footlights, sconces, lens of each moving head, the camera's red tally. */
  const glows = useMemo(() => {
    const small: number[] = [], smallC: number[] = [], big: number[] = [], bigC: number[] = [];
    const warmC = new THREE.Color("#ffd9a0"), pink = new THREE.Color("#ff5aa5"), red = new THREE.Color("#ff2a2a");
    const add = (arr: number[], col: number[], p: V3, c: THREE.Color) => { arr.push(...p); col.push(c.r, c.g, c.b); };
    for (const [cx, , cz] of CHANDELIERS) {
      const { R, y } = CH_RINGS[0]!;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; add(small, smallC, [cx + Math.cos(a) * R, y + 0.16, cz + Math.sin(a) * R], warmC); }
      add(big, bigC, [cx, 5.85, cz], warmC);
    }
    for (let x = -4.5; x <= 4.51; x += 1) if (Math.abs(x) > 1) add(small, smallC, [x, STAGE_Y + 0.05, STAGE_FRONT - 0.12], warmC);
    for (const sx of [-1, 1]) for (const z of PANEL_Z) add(big, bigC, [sx * (HALL_HALF_W - 0.27), 3.58, z], warmC);
    for (const [i, x] of HEADS_X.entries()) add(small, smallC, [x, HEAD_Y - 0.12, HEAD_Z], i % 2 ? warmC : pink);
    const cam = new THREE.Vector3(0.12, 1.6, -0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), TV_CAM.yaw).add(new THREE.Vector3(...TV_CAM.p));
    add(small, smallC, [cam.x, cam.y, cam.z], red);
    const make = (p: number[], c: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      return g;
    };
    return { small: make(small, smallC), big: make(big, bigC) };
  }, []);

  useEffect(() => () => { Object.values(tex).forEach((t) => t.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [tex, mats]);
  useEffect(() => () => { Object.values(geo).forEach((g) => g?.dispose()); }, [geo]);
  useEffect(() => () => { glows.small.dispose(); glows.big.dispose(); }, [glows]);
  return { tex, mats, geo, glows };
}

/** Gala chairs behind every audience spot: velvet seat and back, gold legs and frame (two instanced draws). */
function Chairs({ count, velvet, gold }: { count: number; velvet: THREE.Material; gold: THREE.Material }) {
  const geos = useMemo(() => ({
    soft: merge([box(0.56, 0.09, 0.44, [0, 0.47, 0.38]), box(0.5, 0.6, 0.08, [0, 0.88, 0.62])]),
    frame: merge([
      ...[[-0.25, 0.2], [0.25, 0.2], [-0.25, 0.56], [0.25, 0.56]].map(([x, z]) => cyl(0.018, 0.014, 0.43, [x!, 0.215, z!], 8)),
      cyl(0.02, 0.02, 0.76, [-0.27, 0.82, 0.64], 8), cyl(0.02, 0.02, 0.76, [0.27, 0.82, 0.64], 8),
      torus(0.27, 0.02, [0, 1.18, 0.64], undefined, Math.PI, 20), box(0.58, 0.025, 0.03, [0, 0.52, 0.17]),
    ]),
  }), []);
  const soft = useRef<THREE.InstancedMesh>(null);
  const frame = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const d = new THREE.Object3D();
    for (const m of [soft.current, frame.current]) {
      if (!m) continue;
      for (let i = 0; i < count; i++) { d.position.set(...seatPosition(i)); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [count]);
  useEffect(() => () => { geos.soft.dispose(); geos.frame.dispose(); }, [geos]);
  return (
    <>
      <instancedMesh key={`s${count}`} ref={soft} args={[geos.soft, velvet, count]} />
      <instancedMesh key={`f${count}`} ref={frame} args={[geos.frame, gold, count]} />
    </>
  );
}

/** Faceted crystal drops hanging from every chandelier ring (one instanced draw). */
function Crystals({ material }: { material: THREE.Material }) {
  const spots = useMemo(() => {
    const out: { p: V3; s: number }[] = [];
    for (const [cx, , cz] of CHANDELIERS) {
      CH_RINGS.forEach(({ R, y }) => {
        const n = Math.round(R * 44);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          out.push({ p: [cx + Math.cos(a) * R, y - 0.09, cz + Math.sin(a) * R], s: 1 });
          if (k % 2 === 0) out.push({ p: [cx + Math.cos(a) * R, y - 0.21, cz + Math.sin(a) * R], s: 0.75 });
        }
      });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; out.push({ p: [cx + Math.cos(a) * 0.1, 5.45 - (k % 2) * 0.1, cz + Math.sin(a) * 0.1], s: 1.2 }); }
      out.push({ p: [cx, 5.3, cz], s: 2 });
    }
    return out;
  }, []);
  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new THREE.Object3D();
    spots.forEach((c, i) => { d.position.set(...c.p); d.scale.set(0.03 * c.s, 0.075 * c.s, 0.03 * c.s); d.rotation.set(0, i * 0.7, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <instancedMesh ref={ref} args={[geo, material, spots.length]} />;
}

/** Bouquets of roses and leaves in both urns (two instanced draws). */
function Bouquets({ rose, leaf }: { rose: THREE.Material; leaf: THREE.Material }) {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const roses = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const N = 46, L = 34;
  useEffect(() => {
    const d = new THREE.Object3D(), c = new THREE.Color();
    const palette = ["#f8eef3", "#ff4f98", "#c2185b", "#ffd1e6"];
    let seed = 5;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    URNS.forEach(([ux, , uz], u) => {
      for (let k = 0; k < N; k++) {
        const th = r() * Math.PI * 2, ph = Math.sqrt(r()) * 1.25;
        d.position.set(ux + Math.sin(ph) * Math.cos(th) * 0.36, 1.12 + Math.cos(ph) * 0.3, uz + Math.sin(ph) * Math.sin(th) * 0.36);
        d.scale.setScalar(0.06 + r() * 0.025); d.rotation.set(r() * 3, r() * 3, 0); d.updateMatrix();
        roses.current?.setMatrixAt(u * N + k, d.matrix);
        roses.current?.setColorAt(u * N + k, c.set(palette[k % palette.length]!));
      }
      for (let k = 0; k < L; k++) {
        const th = r() * Math.PI * 2, ph = 0.9 + r() * 0.7;
        d.position.set(ux + Math.sin(ph) * Math.cos(th) * 0.4, 1.12 + Math.cos(ph) * 0.3, uz + Math.sin(ph) * Math.sin(th) * 0.4);
        d.scale.set(0.11, 0.018, 0.05); d.rotation.set(r() * 0.8 - 0.4, -th, ph - 0.6); d.updateMatrix();
        leaves.current?.setMatrixAt(u * L + k, d.matrix);
      }
    });
    for (const m of [roses.current, leaves.current]) { if (!m) continue; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <instancedMesh ref={roses} args={[geo, rose, N * URNS.length]} />
      <instancedMesh ref={leaves} args={[geo, leaf, L * URNS.length]} />
    </>
  );
}

/** Moving-head spotlights on the truss: heads, visible beams and light pools on the floor, all sweeping. */
function MovingHeads({ excited, head, beam, pool }: { excited: boolean; head: THREE.Material; beam: THREE.MeshBasicMaterial; pool: THREE.Material }) {
  const geos = useMemo(() => {
    const cone = new THREE.ConeGeometry(1, 1, 24, 1, true);
    cone.translate(0, -0.5, 0);
    const h = merge([cyl(0.1, 0.12, 0.28, [0, -0.06, 0], 16), cyl(0.085, 0.085, 0.02, [0, -0.205, 0], 16)]);
    const p = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    return { cone, h, p };
  }, []);
  const heads = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  const n = HEADS_X.length;
  const tmp = useMemo(() => ({ d: new THREE.Object3D(), from: new THREE.Vector3(), to: new THREE.Vector3(), dir: new THREE.Vector3(), q: new THREE.Quaternion(), down: new THREE.Vector3(0, -1, 0) }), []);
  useEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { beams.current?.setColorAt(i, c.set(i % 2 ? "#fff1d6" : "#ff4fa0")); pools.current?.setColorAt(i, c.set(i % 2 ? "#fff1d6" : "#ff4fa0")); }
    if (beams.current?.instanceColor) beams.current.instanceColor.needsUpdate = true;
    if (pools.current?.instanceColor) pools.current.instanceColor.needsUpdate = true;
  }, [n]);
  const speed = useRef(1);
  const t = useRef(0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    speed.current += ((excited ? 2.6 : 1) - speed.current) * (1 - Math.exp(-2 * dt));
    t.current += dt * speed.current;
    beam.opacity = excited ? 0.075 : 0.05;
    const { d, from, to, dir, q, down } = tmp;
    HEADS_X.forEach((x, i) => {
      from.set(x, HEAD_Y, HEAD_Z);
      to.set(x * 0.55 + Math.sin(t.current * 0.45 + i * 1.7) * 2.6, 0, 3.2 + Math.cos(t.current * 0.33 + i * 1.1) * 3.2);
      dir.copy(to).sub(from);
      const len = dir.length();
      dir.normalize();
      q.setFromUnitVectors(down, dir);
      d.position.copy(from); d.quaternion.copy(q); d.scale.set(1, 1, 1); d.updateMatrix();
      heads.current?.setMatrixAt(i, d.matrix);
      d.scale.set(len * 0.12, len, len * 0.12); d.updateMatrix();
      beams.current?.setMatrixAt(i, d.matrix);
      d.position.set(to.x, 0.012, to.z); d.quaternion.identity(); d.scale.setScalar(len * 0.3); d.updateMatrix();
      pools.current?.setMatrixAt(i, d.matrix);
    });
    for (const m of [heads.current, beams.current, pools.current]) if (m) m.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => () => { geos.cone.dispose(); geos.h.dispose(); geos.p.dispose(); }, [geos]);
  return (
    <>
      <instancedMesh ref={heads} args={[geos.h, head, n]} frustumCulled={false} />
      <instancedMesh ref={beams} args={[geos.cone, beam, n]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={pools} args={[geos.p, pool, n]} frustumCulled={false} renderOrder={1} />
    </>
  );
}

/** Light sweeping across the LED wall. */
function ScreenSheen({ material, map }: { material: THREE.Material; map: THREE.Texture }) {
  useFrame((_, raw) => { map.offset.x -= Math.min(raw, 0.05) * 0.12; });
  return <mesh position={[0, 3.05, STAGE_BACK + 0.012]} material={material}><planeGeometry args={[8.4, 4.7]} /></mesh>;
}

/** Ballon d'Or gala hall: marble floor, carpet, gold proscenium with velvet curtains, LED wall, chandeliers, risers and chairs. */
export function GalaHall({ rows, excited }: { rows: number; excited: boolean }) {
  const { tex, mats, geo, glows } = useHallAssets(rows);
  const floorLen = HALL_BACK - STAGE_BACK;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (HALL_BACK + STAGE_BACK) / 2]} material={mats.floor}>
        <planeGeometry args={[HALL_HALF_W * 2, floorLen]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, (STAGE_FRONT + 0.6 + HALL_BACK - 0.4) / 2]} material={mats.carpet}>
        <planeGeometry args={[1.4, HALL_BACK - 0.4 - STAGE_FRONT - 0.6]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, CEILING_Y, (HALL_BACK + STAGE_FRONT) / 2]} rotation-z={0} scale={[1, -1, 1]} material={mats.ceiling}>
        <planeGeometry args={[HALL_HALF_W * 2, HALL_BACK - STAGE_FRONT]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, STAGE_Y + 0.002, (STAGE_FRONT + STAGE_BACK) / 2]} material={mats.stageTop}>
        <planeGeometry args={[STAGE_HALF_W * 2, STAGE_FRONT - STAGE_BACK]} />
      </mesh>
      <mesh position={[0, 0.23, STAGE_FRONT + 0.004]} material={mats.fascia}><planeGeometry args={[STAGE_HALF_W * 2, 0.34]} /></mesh>
      <mesh position={[0, 3.05, STAGE_BACK]} material={mats.screen}><planeGeometry args={[8.4, 4.7]} /></mesh>
      <ScreenSheen material={mats.sheen} map={tex.sheen} />

      <mesh geometry={geo.lacquer} material={mats.lacquer} />
      <mesh geometry={geo.gold} material={mats.gold} />
      <mesh geometry={geo.goldGlow} material={mats.goldGlow} />
      <mesh geometry={geo.neon} material={mats.neon} />
      <mesh geometry={geo.steel} material={mats.steel} />
      <mesh geometry={geo.warm} material={mats.warm} />
      <mesh geometry={geo.velvet} material={mats.velvet} />
      <mesh geometry={geo.walls} material={mats.walls} />
      {geo.risers && <mesh geometry={geo.risers} material={mats.riser} />}

      <Curtains material={mats.curtain} fringe={mats.gold} />
      <Chairs count={rows * SEATS_PER_ROW} velvet={mats.velvet} gold={mats.gold} />
      <Crystals material={mats.crystal} />
      <Bouquets rose={mats.rose} leaf={mats.leaf} />
      <MovingHeads excited={excited} head={mats.lacquer} beam={mats.beam} pool={mats.pool} />
      {/* Light washes above the wall sconces */}
      {[-1, 1].map((sx) => PANEL_Z.map((z) => (
        <mesh key={`${sx}${z}`} position={[sx * (HALL_HALF_W - 0.03), 4.1, z]} rotation-y={-sx * Math.PI / 2} material={mats.wash}>
          <planeGeometry args={[2, 3.6]} />
        </mesh>
      )))}
      <points geometry={glows.small} material={mats.glowSmall} />
      <points geometry={glows.big} material={mats.glowBig} />
      {/* Warm chandelier light over the audience */}
      <pointLight position={[-3.4, 5.4, 3.4]} intensity={9} distance={11} color="#ffd9a0" />
      <pointLight position={[3.4, 5.4, 3.4]} intensity={9} distance={11} color="#ffd9a0" />
      <Sparkles count={70} scale={[10, 4.5, 7]} position={[0, 3.2, 1]} size={2.4} speed={0.25} opacity={0.65} color="#ffe2a8" noise={0.6} />
      <Sparkles count={40} scale={[8, 1.2, 7]} position={[0, 5.7, 5]} size={1.6} speed={0.5} opacity={0.8} color="#ffffff" />
    </group>
  );
}

function Curtains({ material, fringe }: { material: THREE.Material; fringe: THREE.Material }) {
  const geos = useMemo(() => ({ side: curtainGeometry(1.4, STAGE_Y, 6.45), valance: valanceGeometry(10.8, 6.45, 6) }), []);
  useEffect(() => () => { geos.side.dispose(); geos.valance.cloth.dispose(); geos.valance.fringe.dispose(); }, [geos]);
  return (
    <>
      <mesh geometry={geos.side} material={material} position={[-5.34, 0, -1.8]} />
      <mesh geometry={geos.side} material={material} position={[5.34, 0, -1.8]} scale={[-1, 1, 1]} />
      <mesh geometry={geos.valance.cloth} material={material} position={[0, 0, -1.42]} />
      <mesh geometry={geos.valance.fringe} material={fringe} position={[0, 0, -1.42]} />
    </>
  );
}

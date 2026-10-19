import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CardFire, toRgb } from "@/components/CardFire";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

// The card is 5:7, so a 100x140 viewBox maps 1:1 without distortion.
const ORBIT = "M12,2.5 H88 Q97.5,2.5 97.5,12 V128 Q97.5,137.5 88,137.5 H12 Q2.5,137.5 2.5,128 V12 Q2.5,2.5 12,2.5 Z";
/** Secret Ultimate frame: realistic particle fire along the card edges (the 3D dragon lives outside the card, see SuDragon3D). */
export function SecretUltimateFx() {
  return <CardFire className="su-fire" />;
}

const Dragon3D = lazy(() => import("@/components/Dragon3D"));

/**
 * Real-time 3D dragon circling the Secret Ultimate card. Rendered in a transparent overlay that overflows the card,
 * mounted only once hydrated and on screen (one WebGL context per visible card), and skipped for reduced motion.
 */
export function SuDragon3D() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [colors, setColors] = useState<{ glow: string; warm: string; ember: string } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const rgb = (name: string, fb: [number, number, number]) => `rgb(${toRgb(css.getPropertyValue(name).trim(), fb).join(",")})`;
    setColors({ glow: rgb("--flame-mid", [255, 150, 30]), warm: rgb("--flame-core", [255, 244, 190]), ember: rgb("--flame-outer", [215, 40, 20]) });
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="su-dragon3d" aria-hidden="true">
      {visible && !reduced && colors && (
        <Suspense fallback={null}>
          <Dragon3D glow={colors.glow} warm={colors.warm} ember={colors.ember} />
        </Suspense>
      )}
    </div>
  );
}

const DIAMOND_LAP_S = 6;
const TRAIL = [1, 2, 3, 4, 5];

// Small diamonds gravitating over the card face on three nested, tilted ellipses centred on the card
// (viewBox 100x140), alternating direction. Gems on a ring are evenly spaced so the face stays balanced;
// each one shrinks and dims on the far side of its ring to read as a 3D orbit.
type Ring = { rx: number; ry: number; tilt: number; lap: number; cw: boolean; gems: number; size: number };
const RINGS: Ring[] = [
  { rx: 41, ry: 58, tilt: 0, lap: 16, cw: true, gems: 3, size: 0.75 },
  { rx: 33, ry: 47, tilt: 24, lap: 12, cw: false, gems: 3, size: 0.6 },
  { rx: 22, ry: 34, tilt: -28, lap: 9, cw: true, gems: 2, size: 0.5 },
];
const ellipse = ({ rx, ry, cw }: Ring) => {
  const sweep = cw ? 1 : 0;
  return `M${50 - rx},70 A${rx},${ry} 0 1 ${sweep} ${50 + rx},70 A${rx},${ry} 0 1 ${sweep} ${50 - rx},70 Z`;
};

function Gem({ fill, scale }: { fill: string; scale: number }) {
  return (
    <g className="sl-gem" transform={`scale(${scale})`}>
      <polygon points="-3,-0.8 -1.8,-2.3 1.8,-2.3 3,-0.8 0,3.2" fill={fill} />
      <path className="sl-gem-facets" d="M-3,-0.8 H3 M-1.8,-2.3 L-0.9,-0.8 L0,-2.3 L0.9,-0.8 L1.8,-2.3 M-0.9,-0.8 L0,3.2 L0.9,-0.8" />
      <path className="sl-gem-star" d="M0,-5.2 L0.45,-2.9 L2.6,-2.5 L0.45,-2.1 L0,0.2 L-0.45,-2.1 L-2.6,-2.5 L-0.45,-2.9 Z" />
    </g>
  );
}

/** Secret Legendary: a brilliant-cut diamond orbiting the card edge with a sparkle trail, plus small diamonds gravitating over the face. */
export function DiamondOrbitFx() {
  const reduced = useReducedMotion();
  const orbit = useSvgId("sl-orbit");
  const gem = useSvgId("sl-gem");
  const ring = useSvgId("sl-ring");
  if (reduced) return null;
  const along = (lag: number) => (
    <animateMotion dur={`${DIAMOND_LAP_S}s`} repeatCount="indefinite" begin={`-${(DIAMOND_LAP_S - lag).toFixed(2)}s`}>
      <mpath href={`#${orbit}`} />
    </animateMotion>
  );
  return (
    <svg className="sl-orbit-fx" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <path id={orbit} d={ORBIT} fill="none" />
        {RINGS.map((r, i) => (
          <path key={i} id={`${ring}-${i}`} d={ellipse(r)} fill="none" />
        ))}
        <linearGradient id={gem} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="sl-stop-light" />
          <stop offset="0.45" className="sl-stop-ice" />
          <stop offset="0.7" className="sl-stop-lilac" />
          <stop offset="1" className="sl-stop-light" />
        </linearGradient>
      </defs>
      {RINGS.map((r, i) => {
        // The path starts at the left point; clockwise passes the far (top) side first.
        const depth = r.cw ? "0.8;0.5;0.8;1.15;0.8" : "0.8;1.15;0.8;0.5;0.8";
        const fade = r.cw ? "0.85;0.35;0.85;1;0.85" : "0.85;1;0.85;0.35;0.85";
        return (
          <g key={i} transform={`rotate(${r.tilt} 50 70)`}>
            {Array.from({ length: r.gems }, (_, k) => {
              const begin = `-${((r.lap * k) / r.gems + i * 1.7).toFixed(2)}s`;
              return (
                <g key={k} className="sl-satellite" style={{ animationDelay: `${(i * 0.37 + k * 0.53).toFixed(2)}s` }}>
                  <animateMotion dur={`${r.lap}s`} repeatCount="indefinite" begin={begin}>
                    <mpath href={`#${ring}-${i}`} />
                  </animateMotion>
                  <g transform={`rotate(${-r.tilt})`}>
                    <g>
                      <animateTransform attributeName="transform" type="scale" values={depth} keyTimes="0;0.25;0.5;0.75;1" dur={`${r.lap}s`} begin={begin} repeatCount="indefinite" />
                      <animate attributeName="opacity" values={fade} keyTimes="0;0.25;0.5;0.75;1" dur={`${r.lap}s`} begin={begin} repeatCount="indefinite" />
                      <Gem fill={`url(#${gem})`} scale={r.size} />
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
      {TRAIL.map((n) => (
        <g key={n}>
          {along(n * 0.07)}
          <circle className="sl-trail" r={1.1 - n * 0.16} style={{ opacity: 1 - n * 0.17 }} />
        </g>
      ))}
      <g>
        {along(0)}
        <Gem fill={`url(#${gem})`} scale={1.3} />
      </g>
    </svg>
  );
}

/** Shiny: SVG filter mapping the photo to an inverted navy-blue / white neon duotone with a soft bloom. */
export function NeonInvertFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" />
        {/* Inverted duotone: dark tones become white, bright tones become deep navy blue. */}
        <feComponentTransfer result="duo">
          <feFuncR type="table" tableValues="0.98 0.86 0.3 0.06 0.03" />
          <feFuncG type="table" tableValues="0.99 0.9 0.4 0.12 0.07" />
          <feFuncB type="table" tableValues="1 1 0.78 0.38 0.24" />
        </feComponentTransfer>
        <feGaussianBlur in="duo" stdDeviation="2.5" result="bloom" />
        <feBlend in="duo" in2="bloom" mode="screen" />
      </filter>
    </svg>
  );
}

export function useNeonFilterId() {
  return useSvgId("gm-neon");
}

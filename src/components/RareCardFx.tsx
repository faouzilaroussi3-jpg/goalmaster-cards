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
  const [colors, setColors] = useState<{ glow: string; warm: string } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const rgb = (name: string, fb: [number, number, number]) => `rgb(${toRgb(css.getPropertyValue(name).trim(), fb).join(",")})`;
    setColors({ glow: rgb("--flame-mid", [255, 150, 30]), warm: rgb("--flame-core", [255, 244, 190]) });
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="su-dragon3d" aria-hidden="true">
      {visible && !reduced && colors && (
        <Suspense fallback={null}>
          <Dragon3D glow={colors.glow} warm={colors.warm} />
        </Suspense>
      )}
    </div>
  );
}

const DIAMOND_LAP_S = 6;
const TRAIL = [1, 2, 3, 4, 5];

/** Secret Legendary: a small brilliant-cut diamond orbiting the card edge, leaving a sparkle trail. */
export function DiamondOrbitFx() {
  const reduced = useReducedMotion();
  const orbit = useSvgId("sl-orbit");
  const gem = useSvgId("sl-gem");
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
        <linearGradient id={gem} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="sl-stop-light" />
          <stop offset="0.45" className="sl-stop-ice" />
          <stop offset="0.7" className="sl-stop-lilac" />
          <stop offset="1" className="sl-stop-light" />
        </linearGradient>
      </defs>
      {TRAIL.map((n) => (
        <g key={n}>
          {along(n * 0.07)}
          <circle className="sl-trail" r={1.1 - n * 0.16} style={{ opacity: 1 - n * 0.17 }} />
        </g>
      ))}
      <g>
        {along(0)}
        <g className="sl-gem" transform="scale(1.3)">
          <polygon points="-3,-0.8 -1.8,-2.3 1.8,-2.3 3,-0.8 0,3.2" fill={`url(#${gem})`} />
          <path className="sl-gem-facets" d="M-3,-0.8 H3 M-1.8,-2.3 L-0.9,-0.8 L0,-2.3 L0.9,-0.8 L1.8,-2.3 M-0.9,-0.8 L0,3.2 L0.9,-0.8" />
          <path className="sl-gem-star" d="M0,-5.2 L0.45,-2.9 L2.6,-2.5 L0.45,-2.1 L0,0.2 L-0.45,-2.1 L-2.6,-2.5 L-0.45,-2.9 Z" />
        </g>
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

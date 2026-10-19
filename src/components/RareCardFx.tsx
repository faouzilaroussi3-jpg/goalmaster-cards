import { useId, useSyncExternalStore } from "react";
import { CardFire } from "@/components/CardFire";

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
const TRACK = "M12,5 H88 Q95,5 95,12 V128 Q95,135 88,135 H12 Q5,135 5,128 V12 Q5,5 12,5 Z";
const ORBIT = "M12,2.5 H88 Q97.5,2.5 97.5,12 V128 Q97.5,137.5 88,137.5 H12 Q2.5,137.5 2.5,128 V12 Q2.5,2.5 12,2.5 Z";
const LAP_S = 7;
const SEGMENTS = 34;
const GAP_S = 0.036;
/** Secret Ultimate frame: realistic particle fire along the card edges and a dragon slithering around the card. */
export function SecretUltimateFx() {
  const reduced = useReducedMotion();
  const scale = useSvgId("su-scale");
  const track = useSvgId("su-track");

  const motion = (index: number) =>
    reduced ? null : (
      <animateMotion dur={`${LAP_S}s`} repeatCount="indefinite" rotate="auto" begin={`-${((SEGMENTS - index) * GAP_S).toFixed(3)}s`}>
        <mpath href={`#${track}`} />
      </animateMotion>
    );

  return (
    <>
    <CardFire className="su-fire" />
    <svg className="su-fx" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={scale}>
          <stop offset="0" className="su-stop-mid" />
          <stop offset="0.6" className="su-stop-outer" />
          <stop offset="1" className="su-stop-dark" />
        </radialGradient>
        <path id={track} d={TRACK} fill="none" />
      </defs>

      {/* Dragon: tail first so the head is painted on top. */}
      {!reduced && (
        <g className="su-dragon">
          {Array.from({ length: SEGMENTS - 1 }, (_, k) => {
            const i = SEGMENTS - 1 - k; // i = 1 (neck) .. SEGMENTS-1 (tail tip)
            const t = i / SEGMENTS;
            const s = 1.2 - t * 0.9;
            return (
              <g key={i}>
                {motion(i)}
                <g transform={`scale(${s.toFixed(3)})`}>
                  {i === SEGMENTS - 1 ? (
                    <path className="su-dragon-tail" d="M3,0 Q-2,-1 -7,-4.5 Q-4,-0.8 -8,0 Q-4,0.8 -7,4.5 Q-2,1 3,0 Z" />
                  ) : (
                    <>
                      {i % 2 === 0 && <path className="su-dragon-spike" d="M-1.6,-1.8 Q-1.4,-4 -0.2,-5 Q0.4,-3.4 1.4,-1.8 Z" />}
                      <path fill={`url(#${scale})`} className="su-dragon-scale" d="M2.6,0 Q1.2,-2.4 -1.6,-2.2 Q-2.6,0 -1.6,2.2 Q1.2,2.4 2.6,0 Z" />
                      <path className="su-dragon-belly" d="M-1.4,1.3 Q0.6,2 2,0.8" />
                      {(i === 6 || i === 18) && <path className="su-dragon-claw" d="M0,2 L-1,4.4 M0,2 L0.6,4.6 M0,2 L1.8,4.2" />}
                    </>
                  )}
                </g>
              </g>
            );
          })}
          <g>
            {motion(0)}
            <g transform="scale(1.15)">
              <path className="su-dragon-mane" d="M-2.5,-2.8 L-6.5,-1.6 L-3.5,-0.4 L-7,0 L-3.5,0.4 L-6.5,1.6 L-2.5,2.8 Z" />
              <path className="su-dragon-horn" d="M-0.5,-2.6 Q-4,-6.2 -7.5,-5.6 M-0.5,2.6 Q-4,6.2 -7.5,5.6" />
              <path fill={`url(#${scale})`} className="su-dragon-scale" d="M-3,-2.8 Q2,-4.2 5.8,-1.6 L8,-0.7 Q8.7,0 8,0.7 L5.8,1.6 Q2,4.2 -3,2.8 Z" />
              <path className="su-dragon-mouth" d="M3,0.25 L7.6,0.35" />
              <circle className="su-dragon-eye" cx="2.2" cy="-1.5" r="0.75" />
              <path className="su-dragon-whisker" d="M7,-0.7 Q10,-3.2 13,-1.8 M7,0.7 Q10,3.2 13,1.8" />
            </g>
          </g>
        </g>
      )}
    </svg>
    </>
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

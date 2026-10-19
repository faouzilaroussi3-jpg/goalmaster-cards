import { useId, useSyncExternalStore } from "react";

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
const TONGUE = "M0,0 C-3.2,-2.5 -3,-8 0,-15 C0.8,-10 3.4,-7 2.6,-3 C2.2,-1 1.2,0 0,0 Z";

// Flame tongues: [x, y, scale, rotation, delay s]
const TONGUES: [number, number, number, number, number][] = [
  // bottom edge — the tallest flames
  [6, 140, 1.5, 0, 0], [16, 141, 1.9, 0, 0.35], [27, 140, 1.4, 0, 0.7], [38, 141, 2.1, 0, 0.15], [50, 140, 1.6, 0, 0.55],
  [61, 141, 2, 0, 0.9], [72, 140, 1.5, 0, 0.25], [83, 141, 1.9, 0, 0.65], [94, 140, 1.5, 0, 0.45],
  // left and right edges, licking upward
  [1, 122, 1.4, 12, 0.2], [0, 100, 1.2, 12, 0.6], [1, 78, 1.1, 12, 0.1], [0, 56, 0.95, 12, 0.5], [1, 34, 0.8, 12, 0.8],
  [99, 120, 1.4, -12, 0.4], [100, 98, 1.2, -12, 0.0], [99, 76, 1.1, -12, 0.7], [100, 54, 0.95, -12, 0.3], [99, 32, 0.8, -12, 0.55],
  // a few short ones along the top
  [22, 4, 0.55, 0, 0.3], [50, 3.5, 0.6, 0, 0.75], [78, 4, 0.55, 0, 0.1],
];
// Embers: [x, delay s, duration s]
const EMBERS: [number, number, number][] = [
  [8, 0, 2.2], [18, 0.9, 2.8], [29, 0.4, 2.4], [41, 1.4, 3], [52, 0.2, 2.6], [63, 1.1, 2.3],
  [74, 0.6, 2.9], [86, 1.6, 2.5], [93, 0.3, 2.7], [35, 1.9, 3.2], [69, 2.1, 2.6], [12, 2.4, 3],
];

/** Secret Ultimate frame: a raging fire border with flame tongues, embers and a dragon slithering around the card. */
export function SecretUltimateFx() {
  const reduced = useReducedMotion();
  const fire = useSvgId("su-fire");
  const grad = useSvgId("su-grad");
  const tongueGrad = useSvgId("su-tongue");
  const scale = useSvgId("su-scale");
  const track = useSvgId("su-track");

  const motion = (index: number) =>
    reduced ? null : (
      <animateMotion dur={`${LAP_S}s`} repeatCount="indefinite" rotate="auto" begin={`-${((SEGMENTS - index) * GAP_S).toFixed(3)}s`}>
        <mpath href={`#${track}`} />
      </animateMotion>
    );

  return (
    <svg className="su-fx" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id={fire} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07 0.2" numOctaves="2" seed="4" result="noise">
            {!reduced && <animate attributeName="baseFrequency" dur="1.4s" values="0.07 0.2;0.09 0.27;0.07 0.2" repeatCount="indefinite" />}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <linearGradient id={grad} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="su-stop-core" />
          <stop offset="0.35" className="su-stop-mid" />
          <stop offset="0.75" className="su-stop-outer" />
          <stop offset="1" className="su-stop-mid" />
        </linearGradient>
        <linearGradient id={tongueGrad} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="su-stop-core" />
          <stop offset="0.3" className="su-stop-mid" />
          <stop offset="0.75" className="su-stop-outer" />
          <stop offset="1" className="su-stop-outer" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={scale}>
          <stop offset="0" className="su-stop-mid" />
          <stop offset="0.6" className="su-stop-outer" />
          <stop offset="1" className="su-stop-dark" />
        </radialGradient>
        <path id={track} d={TRACK} fill="none" />
      </defs>

      {/* Fire: border ring + flame tongues, all distorted by animated noise so they flicker like real flames. */}
      <g filter={`url(#${fire})`}>
        <rect className="su-flame-glow" x="2" y="2" width="96" height="136" rx="5" fill="none" strokeWidth="9" />
        <rect className="su-flame-outer" x="2.5" y="2.5" width="95" height="135" rx="5" fill="none" stroke={`url(#${grad})`} strokeWidth="5" />
        <rect className="su-flame-core" x="3" y="3" width="94" height="134" rx="4.5" fill="none" strokeWidth="1.4" />
        {TONGUES.map(([x, y, s, r, d], k) => (
          <g key={k} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
            <path className="su-tongue" d={TONGUE} fill={`url(#${tongueGrad})`} style={{ animationDelay: `${d}s` }} />
          </g>
        ))}
      </g>

      {!reduced && (
        <g className="su-embers">
          {EMBERS.map(([x, d, dur], k) => (
            <circle key={k} cx={x} cy="136" r={k % 3 === 0 ? 0.9 : 0.6} style={{ animationDelay: `${d}s`, animationDuration: `${dur}s` }} />
          ))}
        </g>
      )}

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
        <g className="sl-gem">
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

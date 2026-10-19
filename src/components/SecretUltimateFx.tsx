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

// The card is 5:7, so a 100x140 viewBox maps 1:1 without distortion.
const TRACK = "M12,5 H88 Q95,5 95,12 V128 Q95,135 88,135 H12 Q5,135 5,128 V12 Q5,5 12,5 Z";
const LAP_S = 7;
const SEGMENTS = 26;
const GAP_S = 0.055;

/** Secret Ultimate frame: a flickering fire border and a dragon slithering around the card edge. */
export function SecretUltimateFx() {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fire = `su-fire-${uid}`;
  const grad = `su-grad-${uid}`;
  const scale = `su-scale-${uid}`;
  const track = `su-track-${uid}`;

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
        <radialGradient id={scale}>
          <stop offset="0" className="su-stop-mid" />
          <stop offset="0.6" className="su-stop-outer" />
          <stop offset="1" className="su-stop-dark" />
        </radialGradient>
        <path id={track} d={TRACK} fill="none" />
      </defs>

      {/* Fire border: thick outer flames + hot inner core, both distorted by animated noise. */}
      <g filter={`url(#${fire})`}>
        <rect className="su-flame-outer" x="2.5" y="2.5" width="95" height="135" rx="5" fill="none" stroke={`url(#${grad})`} strokeWidth="5" />
        <rect className="su-flame-core" x="3" y="3" width="94" height="134" rx="4.5" fill="none" strokeWidth="1.4" />
      </g>

      {/* Dragon: tail first so the head is painted on top. */}
      {!reduced && (
        <g className="su-dragon">
          {Array.from({ length: SEGMENTS - 1 }, (_, k) => {
            const i = SEGMENTS - 1 - k; // i = 1 (neck) .. SEGMENTS-1 (tail tip)
            const t = i / SEGMENTS;
            const s = 1.15 - t * 0.85;
            return (
              <g key={i}>
                {motion(i)}
                <g transform={`scale(${s.toFixed(3)})`}>
                  {i === SEGMENTS - 1 ? (
                    <path className="su-dragon-tail" d="M2,0 L-4,-2.6 L-2.5,0 L-4,2.6 Z" />
                  ) : (
                    <>
                      <polygon className="su-dragon-spike" points="-1.2,-1.9 0.4,-4.2 1.4,-1.9" />
                      <ellipse rx="2.5" ry="2.1" fill={`url(#${scale})`} className="su-dragon-scale" />
                      {(i === 5 || i === 13) && <path className="su-dragon-claw" d="M0,2 L-1,4.4 M0,2 L0.6,4.6 M0,2 L1.8,4.2" />}
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

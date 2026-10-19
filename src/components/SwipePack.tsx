import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { shouldTear, tearProgress } from "@/lib/pack-swipe";

/** Height of the tear line, as a percentage of the pack image. */
const TEAR_Y = 10;

/** Jagged tear edge from x=from% to x=to% around the tear line. */
function zigzag(from: number, to: number): string[] {
  const pts: string[] = [];
  const step = 3;
  const dir = to >= from ? 1 : -1;
  for (let x = from, i = 0; dir > 0 ? x < to : x > to; x += step * dir, i++) {
    pts.push(`${x}% ${TEAR_Y + (i % 2 ? 0.9 : -0.9)}%`);
  }
  pts.push(`${to}% ${TEAR_Y}%`);
  return pts;
}

/** Large pack whose top strip the player tears off from left to right to open it. */
export function SwipePack({
  image,
  name,
  premium,
  disabled,
  onOpen,
}: {
  image: string;
  name: string;
  premium: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const packRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; lastX: number; lastT: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);

  useEffect(() => {
    setProgress(0);
    setTorn(false);
  }, [image]);

  const width = () => packRef.current?.clientWidth ?? 200;

  function finish() {
    if (disabled || torn) return;
    setProgress(1);
    setTorn(true);
    window.setTimeout(() => {
      onOpen();
      setTorn(false);
      setProgress(0);
    }, 650);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || torn) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, lastX: e.clientX, lastT: performance.now() };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const now = performance.now();
    if (now - s.lastT > 60) { s.lastX = e.clientX; s.lastT = now; }
    setProgress(tearProgress(e.clientX - s.x, width()));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    start.current = null;
    setDragging(false);
    const now = performance.now();
    const velocity = (e.clientX - s.lastX) / Math.max(1, now - s.lastT);
    if (shouldTear(e.clientX - s.x, velocity, width())) finish();
    else setProgress(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      finish();
    }
  }

  const P = Math.round(progress * 1000) / 10;
  const edge = zigzag(0, P);
  const bodyClip = `polygon(${P}% 0, 100% 0, 100% 100%, 0 100%, 0 ${TEAR_Y}%, ${edge.join(", ")})`;
  const flapClip = `polygon(0 0, ${P}% 0, ${[...edge].reverse().join(", ")}, 0 ${TEAR_Y}%)`;
  const ease = dragging ? "none" : "clip-path 420ms cubic-bezier(.2,1.2,.4,1), transform 420ms cubic-bezier(.2,1.2,.4,1)";

  return (
    <div className="relative flex w-full flex-col items-center overflow-hidden py-4">
      <div className="swipe-glow pointer-events-none absolute inset-0" style={{ opacity: 0.25 + progress * 0.75 }} aria-hidden />

      <div
        ref={packRef}
        className={cn(
          "relative z-10 w-44 select-none sm:w-56",
          !dragging && !torn && progress === 0 && !disabled && "anim-float",
          torn && "anim-shake",
          disabled && "opacity-40",
        )}
      >
        <img
          src={image}
          alt={name}
          draggable={false}
          width={768}
          height={1152}
          className={cn("pointer-events-none block w-full", premium && "drop-shadow-[0_0_26px_var(--primary)]")}
          style={{ clipPath: bodyClip, transition: ease }}
        />
        {/* The torn strip peels up from its tear point, then flies away. */}
        <img
          src={image}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 block w-full"
          style={{
            clipPath: flapClip,
            transformOrigin: `${P}% ${TEAR_Y}%`,
            transform: torn
              ? "translate(45%, -70%) rotate(-35deg)"
              : `translateY(${-progress * 8}px) rotate(${-progress * 14}deg)`,
            opacity: torn ? 0 : 1,
            transition: torn ? "transform 600ms cubic-bezier(.3,.6,.4,1), opacity 600ms ease-in" : ease,
          }}
        />

        {!disabled && !torn && (
          <>
            <div className="tear-line pointer-events-none absolute left-[6%] right-[6%]" style={{ top: `${TEAR_Y}%` }} aria-hidden>
              <div className="tear-line-done" style={{ width: `${progress * 100}%` }} />
              <div
                className={cn("tear-handle", progress === 0 && "tear-handle-idle")}
                style={{ left: `${progress * 100}%` }}
              />
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label={`${name} : glisser de gauche à droite sur la ligne du haut pour arracher et ouvrir`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className={cn(
                "tear-zone absolute inset-x-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{ top: `${TEAR_Y - 8}%`, height: "16%", touchAction: "none" }}
            />
          </>
        )}
      </div>

      <p className={cn("relative z-10 mt-4 flex items-center gap-1 font-display text-lg tracking-widest", disabled ? "text-muted-foreground" : "text-primary")}>
        {disabled ? "Aucun pack disponible" : "Glisse sur la ligne de gauche à droite pour arracher"}
        {!disabled && <ChevronsRight className="swipe-hint h-5 w-5" aria-hidden />}
      </p>
    </div>
  );
}

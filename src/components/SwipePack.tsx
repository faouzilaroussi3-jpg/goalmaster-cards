import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { dragOffset, shouldOpen, swipeProgress } from "@/lib/pack-swipe";

/** Large pack that the player drags to the left to open. */
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
  const stageRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; t: number; lastX: number; lastT: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // A new pack selection resets the stage.
  useEffect(() => {
    setDx(0);
    setLeaving(false);
  }, [image]);

  const width = stageRef.current?.clientWidth ?? 400;
  const progress = swipeProgress(dx, width);

  function launch() {
    if (disabled || leaving) return;
    setLeaving(true);
    setDx(-(window.innerWidth + width));
    window.setTimeout(() => {
      onOpen();
      setLeaving(false);
      setDx(0);
    }, 380);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || leaving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    start.current = { x: e.clientX, t: now, lastX: e.clientX, lastT: now };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const now = performance.now();
    // Keep a short window for velocity so a slow drag ending in a flick still counts.
    if (now - s.lastT > 60) { s.lastX = e.clientX; s.lastT = now; }
    setDx(dragOffset(e.clientX - s.x));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    start.current = null;
    setDragging(false);
    const now = performance.now();
    const raw = e.clientX - s.x;
    const velocity = (e.clientX - s.lastX) / Math.max(1, now - s.lastT);
    if (shouldOpen(raw, velocity, width)) launch();
    else setDx(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      launch();
    }
  }

  const rotate = dx * 0.04;
  const lift = Math.min(1, Math.abs(dx) / 200);

  return (
    <div ref={stageRef} className="swipe-stage relative flex w-full flex-col items-center overflow-hidden py-4">
      <div
        className="swipe-glow pointer-events-none absolute inset-0"
        style={{ opacity: 0.25 + progress * 0.75 }}
        aria-hidden
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${name} : glisser vers la gauche pour ouvrir`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "swipe-pack relative z-10 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl",
          disabled ? "cursor-not-allowed opacity-40" : dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{
          transform: `translate3d(${dx}px, ${-lift * 14}px, 0) rotate(${rotate}deg) scale(${1 + lift * 0.05})`,
          transition: dragging ? "none" : leaving
            ? "transform 380ms cubic-bezier(.5,0,.9,.4), opacity 380ms ease-in"
            : "transform 520ms cubic-bezier(.2,1.5,.4,1)",
          opacity: leaving ? 0 : 1,
          touchAction: "pan-y",
        }}
      >
        <img
          src={image}
          alt={name}
          draggable={false}
          width={768}
          height={1152}
          className={cn(
            "pointer-events-none w-44 sm:w-56",
            !dragging && !leaving && !disabled && "anim-float",
            premium && "drop-shadow-[0_0_26px_var(--primary)]",
          )}
        />
      </div>
      <p
        className={cn("relative z-10 mt-4 flex items-center gap-1 font-display text-lg tracking-widest", disabled ? "text-muted-foreground" : "text-primary")}
      >
        {!disabled && <ChevronsLeft className="swipe-hint h-5 w-5" aria-hidden />}
        {disabled ? "Aucun pack disponible" : "Glisse vers la gauche pour ouvrir"}
      </p>
    </div>
  );
}

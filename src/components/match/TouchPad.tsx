import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Pad, PadAction } from "@/lib/pad";
import { cn } from "@/lib/utils";

const RADIUS = 46;

/** On-screen controls for phones and tablets: a floating stick on the left, action buttons on the right. */
export function TouchPad({ pad }: { pad: Pad }) {
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const stickDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (origin.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setKnob({ x: 0, y: 0, ox: e.clientX - r.left, oy: e.clientY - r.top });
  };
  const stickMove = (e: RPointerEvent<HTMLDivElement>) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    let dx = e.clientX - o.x, dy = e.clientY - o.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    pad.touch = { mx: dx / RADIUS, my: dy / RADIUS };
    setKnob((k) => (k ? { ...k, x: dx, y: dy } : k));
  };
  const stickUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    pad.touch = { mx: 0, my: 0 };
    setKnob(null);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-sfx="none">
      <div
        className="lm-stick-zone pointer-events-auto relative h-40 w-44 touch-none rounded-3xl sm:h-48 sm:w-56"
        onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}
        aria-label="Stick de déplacement"
      >
        {knob ? (
          <div className="lm-stick-base absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: knob.ox, top: knob.oy }}>
            <div className="lm-stick-knob absolute left-1/2 top-1/2 h-11 w-11 rounded-full" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
          </div>
        ) : (
          <div className="lm-stick-base absolute bottom-4 left-4 flex h-24 w-24 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Glisse</div>
        )}
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-2">
        <TBtn pad={pad} action="swap" label="Changer" small />
        <TBtn pad={pad} action="through" label="Profondeur" />
        <TBtn pad={pad} action="cross" label="Centre" />
        <TBtn pad={pad} action="sprint" label="Sprint" small />
        <TBtn pad={pad} action="pass" label="Passe" big />
        <TBtn pad={pad} action="shot" label="Tir" big accent />
      </div>
    </div>
  );
}

function TBtn({ pad, action, label, big, small, accent }: { pad: Pad; action: PadAction; label: string; big?: boolean; small?: boolean; accent?: boolean }) {
  const [on, setOn] = useState(false);
  const src = `t:${action}`;
  return (
    <button
      type="button" data-sfx="none" aria-label={label}
      className={cn("lm-tbtn touch-none select-none rounded-full font-display tracking-wide",
        big ? "h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl" : small ? "h-12 w-12 self-end justify-self-center text-[11px]" : "h-14 w-14 text-xs sm:h-16 sm:w-16 sm:text-sm",
        accent && "lm-tbtn-accent", on && "lm-tbtn-on")}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setOn(true); pad.press(action, src); }}
      onPointerUp={() => { setOn(false); pad.release(action, src); }}
      onPointerCancel={() => { setOn(false); pad.release(action, src); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

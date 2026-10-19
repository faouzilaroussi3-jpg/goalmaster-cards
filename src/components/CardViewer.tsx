import { useEffect, useRef, useState, type PointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RotateCcw, Repeat2, X } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { CardBack } from "@/components/CardBack";
import { rarityMeta, VERSION_LABEL, type CardData } from "@/lib/rarity";
import { dragRotation, flipRotation, type Rotation } from "@/lib/card-viewer";
import { sfx } from "@/lib/sfx";

/** Enlarged card you can drag to rotate in 3D (front + Goalmaster back). */
export function CardViewer({ card, missing, count, onClose }: { card: CardData | null; missing?: boolean | undefined; count?: number | undefined; onClose: () => void }) {
  const [rot, setRot] = useState<Rotation>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ px: number; py: number; start: Rotation } | null>(null);
  // Rotation sound: a swish each time the card has turned another ~35°, louder when spun fast.
  const spin = useRef({ acc: 0, lastY: 0, lastT: 0 });

  useEffect(() => { setRot({ x: 0, y: 0 }); }, [card]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, start: rot };
    spin.current = { acc: 0, lastY: rot.y, lastT: performance.now() };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = dragRotation(d.start, e.clientX - d.px, e.clientY - d.py);
    const s = spin.current;
    const now = performance.now();
    const delta = Math.abs(next.y - s.lastY);
    s.acc += delta;
    if (s.acc > 35) {
      const speed = delta / Math.max(8, now - s.lastT);
      sfx.whoosh(0.3 + speed * 0.6);
      s.acc = 0;
    }
    s.lastY = next.y;
    s.lastT = now;
    setRot(next);
  };
  const up = () => {
    drag.current = null;
    setDragging(false);
  };

  const r = card ? rarityMeta(card.rarity) : null;
  const version = card?.version ?? "normal";
  const btn = "inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground hover:bg-accent";

  return (
    <DialogPrimitive.Root open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="card-viewer-overlay fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-hidden p-4 outline-none" onClick={(e) => e.target === e.currentTarget && onClose()}>
          {card && r && (
            <>
              <div className="text-center">
                <DialogPrimitive.Title className="font-display text-3xl text-foreground">{card.name}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {r.label}{version !== "normal" ? ` · ${VERSION_LABEL[version]}` : ""}{count ? ` · ${count} exemplaire${count > 1 ? "s" : ""}` : missing ? " · Pas encore obtenue" : ""}
                </DialogPrimitive.Description>
              </div>
              <div
                className="card-viewer-stage"
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onDragStart={(e) => e.preventDefault()}
                aria-label="Faire glisser pour faire pivoter la carte"
              >
                <div
                  className="card-viewer-spin"
                  data-dragging={dragging || undefined}
                  style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`, ["--glare-x" as string]: `${50 - (((rot.y % 360) + 540) % 360 - 180) / 2}%` }}
                >
                  <div className="card-viewer-face">
                    <PlayerCard card={card} missing={!!missing} />
                    <div className="card-viewer-glare" aria-hidden="true" />
                  </div>
                  <div className="card-viewer-face card-viewer-back">
                    <CardBack />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Fais glisser la carte pour la faire pivoter</p>
              <div className="flex gap-2">
                <button type="button" data-sfx="none" className={btn} onClick={() => { sfx.cardFlip(); setRot(flipRotation(rot)); }}>
                  <Repeat2 className="h-4 w-4" /> Retourner
                </button>
                <button type="button" data-sfx="none" className={btn} onClick={() => { sfx.whoosh(0.5); setRot({ x: 0, y: 0 }); }}>
                  <RotateCcw className="h-4 w-4" /> Remettre de face
                </button>
              </div>
              <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-accent" aria-label="Fermer">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

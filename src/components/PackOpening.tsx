import { useEffect, useRef, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardBack } from "@/components/CardBack";
import type { CardBackLook } from "@/lib/card-back";
import { RARITY_VAR } from "@/lib/card-reveal";
import { revealTiming, type RareFx } from "@/lib/rare-reveal";
import { RareRevealFx } from "@/components/RareRevealFx";
import { sfx } from "@/lib/sfx";
import { ChevronsRight } from "lucide-react";

export interface OpenedCard {
  slot: number;
  is_bonus: boolean;
  card_id: string;
  name: string;
  club: string;
  nationality: string;
  pos: string;
  rating: number;
  rarity: string;
  tier: number;
  image_url: string | null;
  version: string;
  is_new: boolean;
  duplicate_coins: number;
}
export interface OpenResult {
  cards: OpenedCard[];
  coins_gained: number;
  xp_gained: number;
}

type Phase = "intro" | "reveal" | "done";

// Smoke puffs behind a Légendaire-or-better card: [left %, top %, delay s, sideways drift %].
const SMOKE_PUFFS: [number, number, number, number][] = [
  [30, 62, 0, -18], [62, 66, 0.6, 16], [46, 74, 1.2, -6], [22, 46, 1.8, -24], [74, 48, 2.4, 22], [50, 56, 3, 8], [36, 80, 3.6, -12], [66, 82, 4.2, 12],
];

/** Offset of a face-down card sitting `depth` places behind the front of the stack. */
function stackOffset(depth: number) {
  return { x: depth * 9, y: depth * -7, r: depth * 3 };
}

export function PackOpening({
  packImage,
  back,
  result,
  instant = false,
  onClose,
}: {
  packImage: string;
  /** The pack's own card back (colour, effects, shape, picture). */
  back?: CardBackLook | null;
  result: OpenResult | null;
  /** Quick open: skip the face-down stack and show the whole pack straight away. */
  instant?: boolean;
  onClose: () => void;
}) {
  // Decode the pack's own back picture up front so the stack never flashes or stutters while cards flip.
  useEffect(() => {
    if (!back?.image_url) return;
    const img = new Image();
    img.src = back.image_url;
    img.decode?.().catch(() => {});
  }, [back?.image_url]);
  const [phase, setPhase] = useState<Phase>(() => (result ? (instant ? "done" : "reveal") : "intro"));
  // Number of cards turned over so far; the last turned card sits face up at the front of the stack.
  const [turned, setTurned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [rare, setRare] = useState<{ fx: RareFx; key: number; boom: number; total: number; title: boolean; shake: boolean; tint: string | null } | null>(null);
  const stackRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // The server already orders the pack from least rare to rarest, so the best card is revealed last.
  const cards = result ? [...result.cards].sort((a, b) => a.slot - b.slot) : [];
  const total = cards.length;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  // The pack was already torn on the packs page: go straight to the face-down stack.
  useEffect(() => {
    if (phase === "intro" && result) setPhase("reveal");
  }, [phase, result]);
  useEffect(() => { if (phase === "reveal") sfx.stackAppear(); }, [phase]);
  useEffect(() => {
    if (instant && result) { sfx.whoosh(0.8); sfx.packSummary(result.coins_gained); }
    // Only on mount: an instant opening arrives with its result already drawn.
  }, []);

  function triggerFlash(c: OpenedCard) {
    setFlash(rarityMeta(c.rarity).fx);
    later(() => setFlash(null), 900);
  }

  /** Légendaire or better: glow build-up, explosion as the face appears, then lingering light (3.6 to 4.8 s). */
  function playRare(fx: RareFx, key: number, boom: number, total: number, tint: string | null) {
    setRare({ fx, key, boom, total, title: false, shake: false, tint });
    later(() => setRare((r) => (r && r.key === key ? { ...r, title: true, shake: true } : r)), boom);
    later(() => setRare((r) => (r && r.key === key ? { ...r, shake: false } : r)), boom + 500);
    later(() => setRare((r) => (r && r.key === key ? null : r)), total);
  }

  /** One tap: the face-up card goes to the tray and the next card comes forward and turns over. */
  function revealNext() {
    if (busy || phase !== "reveal") return;
    if (turned >= total) { sfx.packSummary(result?.coins_gained ?? 0); setPhase("done"); return; }
    const next = cards[turned];
    if (!next) return;
    const timing = revealTiming(next);
    if (turned > 0) setLeaving(turned - 1);
    setTurned(turned + 1);
    setBusy(true);
    sfx.cardTap();
    if (timing.fx) {
      sfx.rareBuild(timing.fx, timing.charge);
      later(() => sfx.cardFlip(), timing.charge);
      later(() => sfx.rareBoom(timing.fx!), timing.boom);
      playRare(timing.fx, turned + 1, timing.boom, timing.total, rarityMeta(next.rarity).color);
    } else {
      if (next.tier >= 4) { sfx.charge(timing.charge, next.tier); later(() => triggerFlash(next), timing.boom); }
      later(() => sfx.cardFlip(), timing.charge);
      later(() => sfx.reveal(next.tier, next.is_new), timing.boom);
    }
    later(() => setBusy(false), timing.lock);
  }

  function skip() {
    if (!result) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTurned(total);
    setRare(null);
    setBusy(false);
    sfx.whoosh(0.8);
    sfx.packSummary(result.coins_gained);
    setPhase("done");
  }

  const front = turned > 0 ? cards[turned - 1] : undefined;
  const waiting = cards.slice(turned === 0 ? 1 : turned);
  const tray = cards.slice(0, Math.max(0, turned - 1));
  const lastShown = turned >= total && !busy;

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center-safe overflow-y-auto bg-background/95 px-3 py-6 backdrop-blur">
      {flash && (
        <div
          className={cn("pointer-events-none fixed inset-0 z-10 anim-flash", flash === "secret_ultimate" ? "su-overlay" : "bg-primary/40")}
        />
      )}
      {rare && phase === "reveal" && (
        <RareRevealFx key={rare.key} fx={rare.fx} tint={rare.tint} boomAt={rare.boom} total={rare.total} anchor={stackRef} />
      )}
      {rare?.title && front && (
        <div className="pointer-events-none fixed inset-x-0 top-[6%] z-20 flex justify-center px-4">
          <h2 className="rare-title text-center text-5xl sm:text-7xl" data-fx={rare.fx}>
            {rarityMeta(front.rarity).label}
            {front.version !== "normal" && ` ${VERSION_LABEL[front.version]}`}
          </h2>
        </div>
      )}

      {phase === "intro" && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center" aria-label="Ouverture du pack">
          <div className="rays" />
          <div className="opening-glow" />
        </div>
      )}

      {phase === "reveal" && <div className="opening-entry pointer-events-none fixed inset-0 z-40" aria-hidden />}

      {phase === "reveal" && result && (
        <div className="relative flex w-full max-w-3xl flex-col items-center pb-20 sm:pb-24">
          <p className="mb-1 font-display text-2xl tracking-widest text-primary">
            {`CARTE ${Math.max(1, turned)} / ${total}`}
          </p>
          <p className="mb-10 h-5 text-sm text-muted-foreground">
            {busy ? "" : lastShown ? "Touche la carte pour voir ton pack" : "Touche la carte pour la révéler"}
          </p>

          <button
            type="button"
            ref={stackRef}
            data-sfx="none"
            onClick={revealNext}
            aria-label={lastShown ? "Voir le résumé du pack" : "Révéler la carte suivante"}
            className={cn("reveal-stack relative aspect-[5/7] w-52 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64", rare?.shake && "rare-shake")}
          >
            {/* Face-down cards still waiting, furthest first. */}
            {waiting.map((c, i) => ({ c, depth: i + 1 })).reverse().map(({ c, depth }) => {
              const o = stackOffset(depth);
              return (
                <div
                  key={`wait-${cards.indexOf(c)}`}
                  className="reveal-slot absolute inset-0"
                  style={{ transform: `translate(${o.x}px, ${o.y}px) rotate(${o.r}deg)`, zIndex: 10 - depth }}
                >
                  <CardBack look={back} bonus={c.is_bonus} still />
                </div>
              );
            })}

            {/* The first card waits face down at the front before the first tap. */}
            {turned === 0 && cards[0] && (
              <div className="reveal-slot absolute inset-0" style={{ zIndex: 20 }}>
                <CardBack look={back} bonus={cards[0].is_bonus} className="gm-back-idle" />
              </div>
            )}

            {/* The card being turned over: it comes forward from the stack, charges, then flips. */}
            {front && (() => {
              const o = stackOffset(turned === 1 ? 0 : 1);
              const { charge, fx } = revealTiming(front);
              return (
                <div
                  key={`front-${turned}`}
                  className="reveal-front flip absolute inset-0"
                  style={{
                    zIndex: 20,
                    ["--from-x" as string]: `${o.x}px`,
                    ["--from-y" as string]: `${o.y}px`,
                    ["--from-r" as string]: `${o.r}deg`,
                    ["--rc" as string]: rarityMeta(front.rarity).color ?? RARITY_VAR[rarityMeta(front.rarity).fx] ?? "var(--primary)",
                    ["--charge" as string]: `${charge}ms`,
                  }}
                >
                  {(front.tier >= 5 || fx) && !busy && (
                    <div className="rarity-smoke -z-10" aria-hidden style={{ ["--rc" as string]: rarityMeta(front.rarity).color ?? RARITY_VAR[rarityMeta(front.rarity).fx] }}>
                      {SMOKE_PUFFS.map((p, i) => <i key={i} style={{ left: `${p[0]}%`, top: `${p[1]}%`, animationDelay: `${p[2]}s`, ["--drift" as string]: `${p[3]}%` }} />)}
                    </div>
                  )}
                  <div className="flip-inner reveal-flip">
                    <div className="flip-face">
                      <CardBack look={back} bonus={front.is_bonus} still className={cn((front.tier >= 4 || fx) && "gm-back-charge", fx && "gm-back-rare")} />
                    </div>
                    <div className="flip-face flip-back">
                      <PlayerCard card={front} />
                      {front.is_new && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* The previous card slides down into the tray. */}
            {leaving !== null && cards[leaving] && (
              <div key={`leave-${leaving}`} className="reveal-leave absolute inset-0" style={{ zIndex: 30 }} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setLeaving(null); }}>
                <PlayerCard card={cards[leaving]} />
              </div>
            )}
          </button>

          <p className={cn("mt-4 h-8 font-display text-2xl text-gold", busy && "opacity-0")}>
            {front && !busy && (
              <span className="anim-rise inline-block">
                {rarityMeta(front.rarity).label}
                {front.version !== "normal" && ` · ${VERSION_LABEL[front.version]}`}
              </span>
            )}
          </p>

          <div className="mt-2 flex min-h-24 flex-wrap justify-center gap-2" aria-label="Cartes déjà révélées">
            {tray.map((c, i) => (
              <div key={i} className="anim-card-in w-14 sm:w-16">
                <PlayerCard card={c} />
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="relative w-full max-w-5xl">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4">
            {cards.map((c, i) => (
              <div key={i} className="relative anim-card-in" style={{ animationDelay: `${i * 70}ms` }}>
                <PlayerCard card={c} />
                {c.is_new && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}
              </div>
            ))}
          </div>

          <div className="anim-rise mt-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              +{result.xp_gained} XP
              {result.coins_gained > 0 && ` · +${result.coins_gained} pièces (doublons)`} · cartes ajoutées à votre collection
            </p>
            <Button onClick={onClose} className="h-auto bg-gold px-8 py-3 font-display text-xl text-primary-foreground shadow-gold">
              Continuer
            </Button>
          </div>
        </div>
      )}

    </div>
      {result && phase !== "done" && (
        <Button
          variant="secondary"
          data-sfx="none"
          onClick={skip}
          aria-label="Passer l'ouverture et voir le résultat"
          className={cn(
            // Outside the blurred overlay so it stays pinned to the screen. Phone: centred pill above the home bar; tablet and desktop: bottom-right corner, a bit larger.
            "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2",
            "h-11 gap-1.5 rounded-full border border-primary/60 bg-background/80 px-5 font-display text-lg tracking-widest text-primary shadow-gold backdrop-blur",
            "hover:bg-primary hover:text-primary-foreground",
            "sm:bottom-6 sm:left-auto sm:right-6 sm:h-12 sm:translate-x-0 sm:px-6 sm:text-xl",
            "lg:bottom-8 lg:right-8 lg:h-14 lg:px-8 lg:text-2xl",
          )}
        >
          <span>Passer</span>
          <span className="hidden sm:inline">· voir le résultat</span>
          <ChevronsRight className="size-5 lg:size-6" aria-hidden />
        </Button>
      )}
    </>
  );
}

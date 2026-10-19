import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FootballCinematic } from "@/components/FootballCinematic";
import { CardBack } from "@/components/CardBack";
import { chargeDelay, FLIP_MS, RARITY_VAR } from "@/lib/card-reveal";

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

type Phase = "intro" | "football" | "reveal" | "done";

/** Offset of a face-down card sitting `depth` places behind the front of the stack. */
function stackOffset(depth: number) {
  return { x: depth * 9, y: depth * -7, r: depth * 3 };
}

export function PackOpening({
  packImage,
  result,
  onClose,
}: {
  packImage: string;
  result: OpenResult | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => (result ? "football" : "intro"));
  // Number of cards turned over so far; the last turned card sits face up at the front of the stack.
  const [turned, setTurned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [suFx, setSuFx] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Main cards first, bonus card last (it sits at the bottom of the stack).
  const cards = result ? [...result.cards.filter((c) => !c.is_bonus), ...result.cards.filter((c) => c.is_bonus)] : [];
  const main = cards.filter((c) => !c.is_bonus);
  const bonus = cards.find((c) => c.is_bonus);
  const total = cards.length;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  // The pack was already torn on the packs page: go straight to the cinematic.
  useEffect(() => {
    if (phase === "intro" && result) setPhase("football");
  }, [phase, result]);

  const finishFootball = useCallback(() => setPhase((current) => current === "football" ? "reveal" : current), []);

  function triggerFlash(c: OpenedCard) {
    if (c.rarity === "secret_ultimate") {
      setSuFx(true);
      later(() => setSuFx(false), 3200);
    }
    setFlash(c.rarity);
    later(() => setFlash(null), 900);
  }

  /** One tap: the face-up card goes to the tray and the next card comes forward and turns over. */
  function revealNext() {
    if (busy || phase !== "reveal") return;
    if (turned >= total) { setPhase("done"); return; }
    const next = cards[turned];
    if (!next) return;
    const charge = chargeDelay(next.tier, next.is_bonus, next.version);
    if (turned > 0) setLeaving(turned - 1);
    setTurned(turned + 1);
    setBusy(true);
    later(() => { if (next.tier >= 4) triggerFlash(next); }, charge + FLIP_MS * 0.4);
    later(() => setBusy(false), charge + FLIP_MS);
  }

  function skip() {
    if (!result) return;
    setTurned(total);
    setPhase("done");
  }

  const front = turned > 0 ? cards[turned - 1] : undefined;
  const waiting = cards.slice(turned === 0 ? 1 : turned);
  const tray = cards.slice(0, Math.max(0, turned - 1));
  const lastShown = turned >= total && !busy;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-background/95 px-3 py-6 backdrop-blur">
      {flash && (
        <div
          className={cn("pointer-events-none fixed inset-0 z-10 anim-flash", flash === "secret_ultimate" ? "su-overlay" : "bg-primary/40")}
        />
      )}
      {suFx && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="rays" style={{ ["--rc" as string]: "var(--primary-glow)" }} />
          <h2 className="anim-rise relative text-center text-6xl text-gold drop-shadow-[0_0_30px_var(--primary-glow)] sm:text-8xl">
            SECRÈTE ULTIME
          </h2>
        </div>
      )}

      {phase === "intro" && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center" aria-label="Ouverture du pack">
          <div className="rays" />
          <div className="opening-glow" />
        </div>
      )}

      {phase === "football" && result && <FootballCinematic cards={result.cards} onComplete={finishFootball} />}
      {phase === "football" && <div className="opening-entry pointer-events-none fixed inset-0 z-10" aria-hidden />}

      {phase === "reveal" && result && (
        <div className="relative flex w-full max-w-3xl flex-col items-center">
          <p className="mb-1 font-display text-2xl tracking-widest text-primary">
            {front?.is_bonus ? "CARTE BONUS" : `CARTE ${Math.max(1, turned)} / ${total}`}
          </p>
          <p className="mb-6 h-5 text-sm text-muted-foreground">
            {busy ? "" : lastShown ? "Touche la carte pour voir ton pack" : "Touche la carte pour la révéler"}
          </p>

          <button
            type="button"
            onClick={revealNext}
            aria-label={lastShown ? "Voir le résumé du pack" : "Révéler la carte suivante"}
            className="reveal-stack relative aspect-[5/7] w-52 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
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
                  <CardBack bonus={c.is_bonus} />
                </div>
              );
            })}

            {/* The first card waits face down at the front before the first tap. */}
            {turned === 0 && cards[0] && (
              <div className="reveal-slot absolute inset-0" style={{ zIndex: 20 }}>
                <CardBack bonus={cards[0].is_bonus} className="gm-back-idle" />
              </div>
            )}

            {/* The card being turned over: it comes forward from the stack, charges, then flips. */}
            {front && (() => {
              const o = stackOffset(turned === 1 ? 0 : 1);
              const charge = chargeDelay(front.tier, front.is_bonus, front.version);
              return (
                <div
                  key={`front-${turned}`}
                  className="reveal-front flip absolute inset-0"
                  style={{
                    zIndex: 20,
                    ["--from-x" as string]: `${o.x}px`,
                    ["--from-y" as string]: `${o.y}px`,
                    ["--from-r" as string]: `${o.r}deg`,
                    ["--rc" as string]: RARITY_VAR[front.rarity] ?? "var(--primary)",
                    ["--charge" as string]: `${charge}ms`,
                  }}
                >
                  {front.tier >= 5 && <div className="rays reveal-rays" style={{ ["--rc" as string]: RARITY_VAR[front.rarity] }} />}
                  <div className="flip-inner reveal-flip">
                    <div className="flip-face">
                      <CardBack bonus={front.is_bonus} className={cn(front.tier >= 4 && "gm-back-charge")} />
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
              <div key={`leave-${leaving}`} className="reveal-leave absolute inset-0" style={{ zIndex: 30 }} onAnimationEnd={() => setLeaving(null)}>
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
            {main.map((c, i) => (
              <div key={i} className="relative anim-card-in" style={{ animationDelay: `${i * 70}ms` }}>
                <PlayerCard card={c} />
                {c.is_new && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}
              </div>
            ))}
          </div>

          {bonus && (
            <div className="mt-6 flex flex-col items-center">
              <p className="mb-3 font-display text-xl tracking-widest text-primary">CARTE BONUS</p>
              <div className="relative w-40 anim-card-in sm:w-52" style={{ animationDelay: "380ms" }}>
                <PlayerCard card={bonus} />
                {bonus.is_new && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}
              </div>
              <p className="mt-3 font-display text-2xl text-gold">
                {rarityMeta(bonus.rarity).label}
                {bonus.version !== "normal" && ` · ${VERSION_LABEL[bonus.version]}`}
              </p>
            </div>
          )}

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

      {result && phase !== "done" && (
        <Button variant="secondary" onClick={skip} className="fixed bottom-4 right-4 z-30 px-4 py-2 text-xs font-bold uppercase text-muted-foreground">
          Passer
        </Button>
      )}
    </div>
  );
}

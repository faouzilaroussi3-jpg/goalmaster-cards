import { useCallback, useEffect, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FootballCinematic } from "@/components/FootballCinematic";

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

type Phase = "intro" | "burst" | "football" | "reveal" | "bonus-wait" | "bonus" | "done";

export function PackOpening({
  packImage,
  result,
  onClose,
}: {
  packImage: string;
  result: OpenResult | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [suFx, setSuFx] = useState(false);

  const main = result?.cards.filter((c) => !c.is_bonus) ?? [];
  const bonus = result?.cards.find((c) => c.is_bonus);

  // intro -> burst once result arrives
  useEffect(() => {
    if (phase !== "intro" || !result) return;
    const t = setTimeout(() => setPhase("burst"), 1400);
    return () => clearTimeout(t);
  }, [phase, result]);

  useEffect(() => {
    if (phase !== "burst") return;
    const t = setTimeout(() => setPhase("football"), 750);
    return () => clearTimeout(t);
  }, [phase]);

  const finishFootball = useCallback(() => setPhase((current) => current === "football" ? "reveal" : current), []);

  // reveal cards progressively, longer pause for higher tiers
  useEffect(() => {
    if (phase !== "reveal") return;
    if (revealed >= main.length) {
      const t = setTimeout(() => setPhase("bonus-wait"), 900);
      return () => clearTimeout(t);
    }
    const prev = main[revealed - 1];
    const delay = revealed === 0 ? 500 : 450 + (prev ? prev.tier * 120 : 0);
    const t = setTimeout(() => {
      const c = main[revealed];
      if (c && c.tier >= 4) triggerFlash(c);
      setRevealed((r) => r + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [phase, revealed, main.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "bonus-wait" || !bonus) return;
    const suspense = 1800 + bonus.tier * 250 + (bonus.version !== "normal" ? 600 : 0);
    const t = setTimeout(() => {
      triggerFlash(bonus);
      setPhase("bonus");
    }, suspense);
    return () => clearTimeout(t);
  }, [phase, bonus]);

  useEffect(() => {
    if (phase !== "bonus") return;
    const t = setTimeout(() => setPhase("done"), suFx ? 3500 : 1600);
    return () => clearTimeout(t);
  }, [phase, suFx]);

  function triggerFlash(c: OpenedCard) {
    if (c.rarity === "secret_ultimate") {
      setSuFx(true);
      setTimeout(() => setSuFx(false), 3200);
    }
    setFlash(c.rarity);
    setTimeout(() => setFlash(null), 900);
  }

  function skip() {
    if (!result) return;
    setRevealed(main.length);
    setPhase("done");
  }

  const bonusFlipped = phase === "bonus" || phase === "done";

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

      {(phase === "intro" || phase === "burst") && (
        <div className="relative flex flex-col items-center">
          <div className="rays" />
          <img
            src={packImage}
            alt="Booster"
            className={cn("relative w-56 sm:w-72", phase === "intro" ? (result ? "anim-shake" : "anim-float") : "anim-burst")}
          />
          <p className="relative mt-6 font-display text-2xl tracking-widest text-primary">
            {result ? "Ouverture…" : "Préparation du booster…"}
          </p>
        </div>
      )}

      {phase === "football" && result && <FootballCinematic cards={result.cards} onComplete={finishFootball} />}

      {phase !== "intro" && phase !== "burst" && phase !== "football" && result && (
        <div className="relative w-full max-w-5xl">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4">
            {main.map((c, i) => (
              <div key={i} className={cn("flip aspect-[5/7] anim-card-in", i < revealed && "is-flipped")} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flip-inner">
                  <div className="flip-face card-back">
                    <span className="font-display text-2xl text-gold">GM</span>
                  </div>
                  <div className="flip-face flip-back">
                    <PlayerCard card={c} />
                    {c.is_new && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {bonus && phase !== "reveal" && (
            <div className="mt-6 flex flex-col items-center">
              <p className="mb-3 font-display text-xl tracking-widest text-primary">CARTE BONUS</p>
              <div className={cn("flip relative aspect-[5/7] w-40 sm:w-52", bonusFlipped && "is-flipped")}>
                {bonusFlipped && bonus.tier >= 5 && <div className="rays" style={{ ["--rc" as string]: `var(--primary)` }} />}
                <div className="flip-inner">
                  <div className={cn("flip-face card-back", !bonusFlipped && "anim-suspense")}>
                    <span className="font-display text-4xl text-gold">?</span>
                  </div>
                  <div className="flip-face flip-back">
                    <PlayerCard card={bonus} />
                  </div>
                </div>
              </div>
              {bonusFlipped && (
                <p className="anim-rise mt-3 font-display text-2xl text-gold">
                  {rarityMeta(bonus.rarity).label}
                  {bonus.version !== "normal" && ` · ${VERSION_LABEL[bonus.version]}`}
                </p>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="anim-rise mt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                +{result.xp_gained} XP
                {result.coins_gained > 0 && ` · +${result.coins_gained} pièces (doublons)`} · cartes ajoutées à votre collection
              </p>
              <Button onClick={onClose} className="h-auto bg-gold px-8 py-3 font-display text-xl text-primary-foreground shadow-gold">
                Continuer
              </Button>
            </div>
          )}
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

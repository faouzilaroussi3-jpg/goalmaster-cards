import { useState } from "react";
import { Shield, Star, Crown, Sparkles } from "lucide-react";
import { rarityMeta, VERSION_LABEL, type CardData } from "@/lib/rarity";
import { cn } from "@/lib/utils";

export function PlayerCard({
  card,
  missing,
  count,
  className,
}: {
  card: CardData;
  missing?: boolean;
  count?: number;
  className?: string;
}) {
  const r = rarityMeta(card.rarity);
  const version = card.version ?? "normal";
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const Emblem = r.tier >= 5 ? Crown : r.tier >= 3 ? Star : Shield;
  return (
    <div
      className={cn("fm-card select-none", missing && "is-missing", className)}
      data-rarity={card.rarity}
      data-version={version}
    >
      <div className="card-pattern" aria-hidden="true" />
      <div className="card-crest" aria-hidden="true"><Emblem /></div>
      {card.image_url && failedImage !== card.image_url ? (
        <img src={card.image_url} alt={card.name} loading="lazy" className="card-portrait" onError={() => setFailedImage(card.image_url ?? null)} />
      ) : <div className="card-initials" aria-label={card.name}>{card.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>}
      <div className="card-rating">
        <span className="font-display">{card.rating}</span>
        <span className="font-display card-position">{card.pos}</span>
      </div>
      <div className="card-badges">
        <span className="card-rarity-code font-display">
          {r.short}
        </span>
        {version !== "normal" && (
          <span className="card-version font-display">
            {VERSION_LABEL[version]}
          </span>
        )}
      </div>
      {count && count > 1 ? (
        <span className="absolute right-2 top-14 rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          x{count}
        </span>
      ) : null}
      <div className="card-details">
        <div className="card-name font-display">{card.name}</div>
        <div className="card-club">{card.club}</div>
        <div className="card-country">{card.nationality}</div>
        <div className="card-rarity-label">{r.tier >= 4 && <Sparkles aria-hidden="true" />}{r.label}</div>
      </div>
      <div className="holo" />
      {r.tier >= 3 && <div className="sheen" />}
      {r.tier >= 4 && <div className="card-sparks" aria-hidden="true" />}
    </div>
  );
}

export function MysteryCard() {
  return (
    <div className="fm-card flex items-center justify-center" data-rarity="secret_ultimate">
      <div className="text-center">
        <div className="font-display text-6xl text-gold">?</div>
        <div className="font-display text-sm tracking-widest text-muted-foreground">SECRÈTE ULTIME</div>
        <div className="text-[10px] text-muted-foreground">Jamais découverte</div>
      </div>
      <div className="holo" />
    </div>
  );
}

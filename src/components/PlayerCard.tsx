import { useState } from "react";
import { Shield, Star, Crown, Sparkles } from "lucide-react";
import { rarityMeta, VERSION_LABEL, type CardData } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { SecretUltimateFx } from "@/components/SecretUltimateFx";

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
  // ALT cards carry their own illustration; fall back to the normal one (re-framed) when none exists yet.
  const image = version === "alt" ? (card.alt_image_url ?? card.image_url) : card.image_url;
  const reusedArt = version === "alt" && !card.alt_image_url;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const Emblem = r.tier >= 5 ? Crown : r.tier >= 3 ? Star : Shield;
  return (
    <div
      className={cn("fm-card select-none", missing && "is-missing", className)}
      data-rarity={card.rarity}
      data-version={version}
      data-reused-art={reusedArt || undefined}
    >
      <div className="card-pattern" aria-hidden="true" />
      <div className="card-crest" aria-hidden="true"><Emblem /></div>
      {image && failedImage !== image ? (
        <img src={image} alt={card.name} loading="lazy" className="card-portrait" onError={() => setFailedImage(image)} />
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
      {r.tier >= 5 && <div className="card-foil-border" aria-hidden="true" />}
      {r.tier >= 5 && <div className="card-border-glitter" aria-hidden="true" />}
      {r.tier >= 3 && <div className="sheen" />}
      {r.tier >= 4 && <div className="card-sparks" aria-hidden="true" />}
      {card.rarity === "secret_ultimate" && <SecretUltimateFx />}
    </div>
  );
}

import { useState } from "react";
import { Shield, Star, Crown, Sparkles } from "lucide-react";
import { useRarityMeta, VERSION_LABEL, type CardData, type RarityInfo } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { DiamondOrbitFx, NeonInvertFilter, SecretUltimateFx, SuDragonShell, useNeonFilterId } from "@/components/RareCardFx";

export function PlayerCard({
  card,
  missing,
  count,
  className,
  rarityInfo,
}: {
  card: CardData;
  missing?: boolean;
  count?: number;
  className?: string;
  /** Preview a rarity that is not saved yet (admin rarity editor). */
  rarityInfo?: RarityInfo;
}) {
  // Admin-created rarities wear the visual effect (fx, or an extra style drawn instead of its frame) and optional tint chosen for them.
  const known = useRarityMeta(card.rarity);
  const r = rarityInfo ?? known;
  const version = card.version ?? "normal";
  // ALT cards carry their own illustration; fall back to the normal one (re-framed) when none exists yet.
  const image = version === "alt" ? (card.alt_image_url ?? card.image_url) : card.image_url;
  const reusedArt = version === "alt" && !card.alt_image_url;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const neonId = useNeonFilterId();
  const shiny = version === "shiny";
  const Emblem = r.tier >= 5 ? Crown : r.tier >= 3 ? Star : Shield;
  const ultimate = r.fx === "secret_ultimate";
  const body = (
    <div
      className={cn("fm-card select-none", missing && "is-missing", !ultimate && className)}
      data-rarity={r.style ?? r.fx}
      data-rarity-key={card.rarity === r.fx ? undefined : card.rarity}
      style={r.color ? ({ "--rc": r.color } as React.CSSProperties) : undefined}
      data-version={version}
      data-reused-art={reusedArt || undefined}
    >
      {shiny && <NeonInvertFilter id={neonId} />}
      <div className="card-pattern" aria-hidden="true" />
      <div className="card-crest" aria-hidden="true"><Emblem /></div>
      {image && failedImage !== image ? (
        <img src={image} alt={card.name} loading="lazy" className="card-portrait" style={shiny ? { filter: `url(#${neonId})` } : undefined} onError={() => setFailedImage(image)} />
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
      {r.style && <div className="card-style-fx" aria-hidden="true"><i /></div>}
      {r.fx === "secret_legendary" && !r.style && version === "normal" && <DiamondOrbitFx />}
      {ultimate && <SecretUltimateFx />}
    </div>
  );
  if (!ultimate) return body;
  // The dragon's limbs and head stick out of the card's clipped frame, so Secret Ultimate cards get an unclipped shell.
  return <SuDragonShell className={className} missing={missing}>{body}</SuDragonShell>;
}

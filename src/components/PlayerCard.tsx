import { useState } from "react";
import { Shield, Star, Crown, Sparkles } from "lucide-react";
import { effectStyle, useRarityMeta, VERSION_LABEL, type CardData, type RarityEffect, type RarityInfo } from "@/lib/rarity";
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
  const extras = r.extras ?? [];
  const ultimate = r.fx === "secret_ultimate" || extras.includes("secret_ultimate");
  const body = (
    <div
      className={cn("fm-card select-none", missing && "is-missing", !ultimate && className)}
      data-rarity={r.style ?? r.fx}
      data-rarity-key={card.rarity === r.fx ? undefined : card.rarity}
      style={r.color ? ({ "--rc": r.color } as React.CSSProperties) : undefined}
      data-version={version}
      data-shape={r.shape && r.shape !== "standard" ? r.shape : undefined}
      data-reused-art={reusedArt || undefined}
    >
      {shiny && <NeonInvertFilter id={neonId} />}
      <div className="card-pattern" aria-hidden="true" />
      {r.shape === "wanted" && <WantedPaper />}
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
      {r.shape === "wanted" && <div className="card-wanted-reward font-display" aria-hidden="true">Récompense · {(card.rating * 1000).toLocaleString("fr-FR")} $</div>}
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
      {r.style && <div className="card-style-fx" data-fx={r.style} aria-hidden="true"><i /></div>}
      {extras.map((e) => <ExtraFx key={e} fx={e} color={r.color} mainTier={r.tier} version={version} />)}
      {r.fx === "secret_legendary" && !r.style && version === "normal" && <DiamondOrbitFx />}
      {r.fx === "secret_legendary" && !r.style && version === "normal" && (
        <div className="sl-border-gems" aria-hidden="true">
          {SL_GEMS.map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.37) % 2.4}s` }} />)}
        </div>
      )}
      {ultimate && <SecretUltimateFx />}
    </div>
  );
  if (!ultimate) return body;
  // The dragon's limbs and head stick out of the card's clipped frame, so Secret Ultimate cards get an unclipped shell.
  return <SuDragonShell className={className} missing={missing}>{body}</SuDragonShell>;
}

// Colour each extra layer wears when the rarity has no custom tint.
const EXTRA_TINT: Partial<Record<RarityEffect, string>> = {
  uncommon: "var(--r-uncommon)", rare: "var(--r-rare)", super_rare: "var(--r-sr)", legendary: "var(--r-legendary)", secret_legendary: "var(--r-sl)",
};

/** One extra effect mixed over a rarity's main look: the effect's own layers (frame, light, particles), never its fonts or photo treatment. */
function ExtraFx({ fx, color, mainTier, version }: { fx: RarityEffect; color: string | null; mainTier: number; version: string }) {
  const style = effectStyle(fx);
  const tint = { "--rc": color ?? (style ? `var(--fx-${style})` : EXTRA_TINT[fx] ?? "var(--rc)") } as React.CSSProperties;
  if (style) return <div className="card-style-fx is-extra" data-fx={style} style={tint} aria-hidden="true"><i /></div>;
  switch (fx) {
    case "uncommon":
      return <div className="card-extra-frame" style={tint} aria-hidden="true" />;
    case "rare":
      return mainTier >= 3 ? null : <div className="card-fx-group" data-fx={fx} style={tint} aria-hidden="true"><div className="sheen" /></div>;
    case "super_rare":
      return (
        <div className="card-fx-group" data-fx={fx} style={tint} aria-hidden="true">
          {mainTier < 3 && <div className="sheen" />}
          {mainTier < 4 && <div className="card-sparks" />}
        </div>
      );
    case "legendary":
      return <div className="card-fx-group" data-fx={fx} style={tint} aria-hidden="true"><div className="card-foil-border" /><div className="card-border-glitter" /></div>;
    case "secret_legendary":
      return (
        <div className="card-fx-group" data-fx={fx} style={tint} aria-hidden="true">
          <div className="card-foil-border" />
          <div className="card-border-glitter" />
          {version === "normal" && <DiamondOrbitFx />}
          {version === "normal" && (
            <div className="sl-border-gems">
              {SL_GEMS.map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.37) % 2.4}s` }} />)}
            </div>
          )}
        </div>
      );
    default:
      return null; // common: nothing to add; secret_ultimate: fire + dragon are drawn by the card itself.
  }
}

// Diamonds set into the Secret Legendary frame: corners, then evenly along each edge (x%, y%).
const SL_GEMS: [number, number][] = [
  [2.2, 1.6], [97.8, 1.6], [2.2, 98.4], [97.8, 98.4],
  ...[20, 35, 50, 65, 80].flatMap((x) => [[x, 1.6], [x, 98.4]] as [number, number][]),
  ...[15, 28, 41, 54, 67, 80].flatMap((y) => [[2.2, y], [97.8, y]] as [number, number][]),
];

/** Aged poster layers for the Wanted shape: paper texture, stains, header and the pin holding it. */
function WantedPaper() {
  return (
    <>
      <div className="card-wanted-paper" aria-hidden="true" />
      <div className="card-wanted-head" aria-hidden="true"><span>WANTED</span><small>Mort ou vif · sur le terrain</small></div>
      <i className="card-wanted-pin" aria-hidden="true" />
    </>
  );
}

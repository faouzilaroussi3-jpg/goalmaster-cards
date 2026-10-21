import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { isCustomBack, type CardBackLook } from "@/lib/card-back";
import { ExtraFx } from "@/components/PlayerCard";

/** Goalmaster card back: black foil, pink lattice, white frame and a GM medallion; a pack can recolour it, reshape it, add effects or its own picture. */
export function CardBack({ bonus, className, look, still }: { bonus?: boolean; className?: string; look?: CardBackLook | null | undefined; /** Cards waiting in the stack: same look, animations paused to keep flips smooth. */ still?: boolean }) {
  const custom = look && isCustomBack(look) ? look : null;
  const style = custom?.color ? ({ "--primary": custom.color, "--rc": custom.color } as CSSProperties) : ({ "--rc": "var(--primary)" } as CSSProperties);
  return (
    <div className={cn("gm-back", bonus && "gm-back-is-bonus", still && "gm-back-still", className)} aria-hidden
      data-shape={custom && custom.shape !== "standard" ? custom.shape : undefined} data-image={custom?.image_url ? "" : undefined} style={style}>
      {custom?.image_url && <img src={custom.image_url} alt="" className="gm-back-image" draggable={false} />}
      <div className="gm-back-pattern" />
      <div className="gm-back-frame">
        <span className="gm-back-corner gm-back-corner-tl" />
        <span className="gm-back-corner gm-back-corner-tr" />
        <span className="gm-back-corner gm-back-corner-bl" />
        <span className="gm-back-corner gm-back-corner-br" />
      </div>
      {custom?.image_url && <span className="gm-back-image-word">GOALMASTER</span>}
      {!custom?.image_url && (
        <div className="gm-back-center">
          <div className="gm-back-medal">
            <svg viewBox="0 0 100 100" className="gm-back-ball">
              <polygon points="50,30 69,44 62,66 38,66 31,44" />
              <path d="M50 30V12M69 44l17-6M62 66l11 15M38 66 27 81M31 44l-17-6" />
            </svg>
            <span className="gm-back-mono">GM</span>
          </div>
          <span className="gm-back-word">GOALMASTER</span>
        </div>
      )}
      {custom?.effects.map((e) => <ExtraFx key={e} fx={e} color={custom.color} mainTier={1} version="normal" />)}
      {bonus && <span className="gm-back-ribbon">BONUS</span>}
      <div className="gm-back-sheen" />
    </div>
  );
}

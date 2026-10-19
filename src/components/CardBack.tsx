import { cn } from "@/lib/utils";

/** Goalmaster card back: black foil, pink lattice, white frame and a GM medallion. */
export function CardBack({ bonus, className }: { bonus?: boolean; className?: string }) {
  return (
    <div className={cn("gm-back", bonus && "gm-back-is-bonus", className)} aria-hidden>
      <div className="gm-back-pattern" />
      <div className="gm-back-frame">
        <span className="gm-back-corner gm-back-corner-tl" />
        <span className="gm-back-corner gm-back-corner-tr" />
        <span className="gm-back-corner gm-back-corner-bl" />
        <span className="gm-back-corner gm-back-corner-br" />
      </div>
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
      {bonus && <span className="gm-back-ribbon">BONUS</span>}
      <div className="gm-back-sheen" />
    </div>
  );
}

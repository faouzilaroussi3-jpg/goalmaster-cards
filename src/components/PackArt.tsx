import type { CSSProperties, ReactNode } from "react";
import packClassic from "@/assets/pack-classic.png";
import packPremium from "@/assets/pack-premium.png";
import { GoldenFlames } from "@/components/GoldenFlames";
import { tintFilter, type PackLook } from "@/lib/pack-look";
import { cn } from "@/lib/utils";

const ART: Record<string, string> = { classic: packClassic, premium: packPremium };

/** Picture of a pack: the admin's own image, or the base artwork. */
export const packImageOf = (look: PackLook) => look.image_url || ART[look.art] || packClassic;

/** Style for the pack <img>: the tint hue shift, plus the holographic colour cycle. */
export function packImgStyle(look: PackLook): CSSProperties {
  return { filter: look.image_url ? undefined : tintFilter(look.tint) };
}

/** Effect layers drawn around (behind) the pack; wrap the pack picture with this. */
export function PackFx({ look, active = true, className, children }: { look: PackLook; active?: boolean; className?: string; children: ReactNode }) {
  const style = { "--pack-tint": look.tint ?? "var(--primary)" } as CSSProperties;
  return (
    <div className={cn("pack-fx relative", className)} data-fx={look.effect} style={style}>
      {active && look.effect === "flames" && (
        <GoldenFlames className="pointer-events-none absolute -left-[50%] -top-[25%] h-[120%] w-[200%]" />
      )}
      {active && look.effect === "sparkles" && (
        <div className="pack-sparkles pointer-events-none absolute -inset-[18%]" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53 + 11) % 100}%`, animationDelay: `${(i % 7) * 0.35}s` }} />)}
        </div>
      )}
      {active && look.effect === "shadow" && <div className="pack-smoke pointer-events-none absolute -inset-[15%]" aria-hidden />}
      {children}
    </div>
  );
}

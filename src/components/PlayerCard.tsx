import playerImg from "@/assets/player.png";
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
  return (
    <div
      className={cn("fm-card select-none", missing && "is-missing", className)}
      data-rarity={card.rarity}
      data-version={version}
    >
      <img
        src={card.image_url || playerImg}
        alt={card.name}
        loading="lazy"
        className="absolute inset-x-0 bottom-[30%] mx-auto h-[62%] w-auto object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]"
      />
      <div className="absolute left-2.5 top-2 flex flex-col items-center leading-none">
        <span className="font-display text-3xl text-foreground sm:text-4xl">{card.rating}</span>
        <span className="font-display text-sm text-primary">{card.pos}</span>
      </div>
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <span className="rounded bg-background/70 px-1.5 py-0.5 font-display text-xs tracking-wider text-foreground">
          {r.short}
        </span>
        {version !== "normal" && (
          <span className="rounded bg-gold px-1.5 py-0.5 font-display text-xs text-primary-foreground">
            {VERSION_LABEL[version]}
          </span>
        )}
      </div>
      {count && count > 1 ? (
        <span className="absolute right-2 top-14 rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          x{count}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-2 pb-2 pt-6 text-center">
        <div className="truncate font-display text-lg leading-tight text-foreground sm:text-xl">{card.name}</div>
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
          {card.club} · {card.nationality}
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">{r.label}</div>
      </div>
      <div className="holo" />
      {r.tier >= 3 && <div className="sheen" />}
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

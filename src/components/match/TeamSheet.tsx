import { rarityMeta } from "@/lib/rarity";
import { firstName, POSITION_LABEL, TACTICS, type RatedPlayer, type RatedTeam } from "@/lib/manager";
import { cn } from "@/lib/utils";

const FX_VAR: Record<string, string> = {
  common: "--r-common", uncommon: "--r-uncommon", rare: "--r-rare", super_rare: "--r-sr",
  legendary: "--r-legendary", secret_legendary: "--r-sl", secret_ultimate: "--r-su",
};

/** Colour of a rarity (admin tint first, then the built-in token of the effect it wears). */
export function rarityColor(key: string) {
  const r = rarityMeta(key);
  return r.color ?? `var(${FX_VAR[r.fx] ?? "--r-common"})`;
}

export function fitTone(fit: number) {
  return fit === 0 ? "text-r-uncommon" : fit === -3 ? "text-r-legendary" : "text-destructive";
}

export function ChemDots({ chem }: { chem: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Collectif ${chem} sur 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < chem ? "bg-primary" : "bg-muted-foreground/30")} />
      ))}
    </span>
  );
}

const BAR_MIN = 40, BAR_MAX = 100;

export function TeamStats({ team, compare, className }: { team: RatedTeam; compare?: RatedTeam | null; className?: string }) {
  const rows: [string, number, number | undefined][] = [
    ["Attaque", team.attack, compare?.attack],
    ["Milieu", team.midfield, compare?.midfield],
    ["Défense", team.defense, compare?.defense],
    ["Gardien", team.keeper, compare?.keeper],
  ];
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Big label="Général" value={team.general} />
        <Big label="Collectif" value={`${team.collectif}%`} />
        <Big label="Force" value={team.force} />
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, v, c]) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="w-14 text-muted-foreground">{label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct(v)}%` }} />
              {c !== undefined && <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${pct(c)}%` }} title={`Adversaire ${Math.round(c)}`} />}
            </div>
            <span className="w-8 text-right font-bold tabular-nums">{Math.round(v)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{team.formation} · tactique {TACTICS[team.tactic]?.label.toLowerCase()}</p>
    </div>
  );
}

const pct = (v: number) => Math.max(0, Math.min(100, ((v - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100));

function Big({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-secondary/70 px-2 py-1.5">
      <div className="font-display text-2xl leading-none text-primary">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function LineupList({ players, highlight, className }: { players: RatedPlayer[]; highlight?: Set<number>; className?: string }) {
  return (
    <ul className={cn("space-y-1", className)}>
      {players.map((p) => (
        <li key={p.slot} className={cn("flex items-center gap-2 rounded-md bg-secondary/50 px-2 py-1 text-sm", highlight?.has(p.slot) && "ring-1 ring-primary")}>
          <span className="w-9 shrink-0 text-[11px] font-bold text-muted-foreground" title={POSITION_LABEL[p.role]}>{p.role}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rarityColor(p.rarity) }} title={rarityMeta(p.rarity).label} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{firstName(p.name)}</span> <span className="text-muted-foreground">{p.name.split(" ").slice(1).join(" ")}</span>
          </span>
          <span className={cn("text-[10px] font-bold", fitTone(p.fit))}>{p.pos}</span>
          <ChemDots chem={p.chem} />
          <span className="w-7 text-right font-display text-lg leading-none text-primary">{p.eff}</span>
        </li>
      ))}
    </ul>
  );
}

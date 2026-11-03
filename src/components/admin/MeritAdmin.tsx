import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { PlayerStats } from "@/lib/admin-stats";
import { MERIT_DOMAINS, MERIT_MAX, rankMerit, type MeritRow } from "@/lib/ballon-merit";

const fmt = (n: number) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Admin tab: who deserves the Ballon d'Or, from everything each player achieved (all time). */
export function MeritAdmin() {
  const [withAdmins, setWithAdmins] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const rareRank = rarityMeta("rare").rank || 3;
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-player-stats", rareRank],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_player_stats", { _min_rank: rareRank });
      if (error) throw error;
      return (data ?? []) as unknown as PlayerStats[];
    },
  });

  const ranking = useMemo(() => rankMerit(withAdmins ? rows : rows.filter((r) => !r.is_admin)), [rows, withAdmins]);
  const top = ranking[0];

  if (error) return <p className="panel p-4 text-sm text-destructive">{(error as Error).message}</p>;
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="panel space-y-2 p-4 text-sm text-muted-foreground">
        <p>
          Tout ce que chaque joueur a accompli depuis son inscription. Chaque domaine est noté sur 100 par rapport au meilleur
          joueur de ce domaine, puis les notes s'additionnent (sur {MERIT_MAX}). Tous les domaines comptent pareil.
          Visible seulement par les admins.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {MERIT_DOMAINS.map((d) => <span key={d.key}><b className="text-foreground">{d.label}</b> : {d.hint}</span>)}
        </div>
        <label className="flex items-center gap-2 pt-1">
          <input type="checkbox" checked={withAdmins} onChange={(e) => setWithAdmins(e.target.checked)} />
          Inclure les comptes admin
        </label>
      </div>

      {top ? (
        <section className="panel border border-primary/60 p-5 text-center">
          <Crown className="mx-auto h-8 w-8 text-gold" />
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mérite le Ballon d'Or</div>
          <div className="font-display text-5xl text-gold">{top.player.username}</div>
          <div className="text-sm"><b className="text-primary">{fmt(top.total)}</b> <span className="text-muted-foreground">/ {MERIT_MAX} points</span></div>
          <Bars row={top} className="mx-auto mt-4 max-w-md text-left" />
          <Link to="/ballon-dor" className="mt-4 inline-block text-sm text-primary underline">Aller à la cérémonie</Link>
        </section>
      ) : (
        <p className="panel p-6 text-center text-sm text-muted-foreground">Personne n'a encore rien accompli.</p>
      )}

      {ranking.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-3 text-3xl text-gold">Classement complet</h2>
          <ol className="space-y-1.5">
            {ranking.map((r) => {
              const isOpen = open === r.player.user_id;
              return (
                <li key={r.player.user_id}>
                  <button onClick={() => setOpen(isOpen ? null : r.player.user_id)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", r.place === 1 ? "bg-primary/15" : "bg-secondary/40", isOpen && "ring-1 ring-primary/60")}>
                    <span className={cn("w-7 text-center text-lg font-bold", r.place === 1 ? "text-gold" : r.place <= 3 ? "text-primary" : "text-muted-foreground")}>{r.place}</span>
                    <span className="flex-1 truncate font-bold text-foreground">{r.player.username}</span>
                    <span className="hidden h-2 w-32 overflow-hidden rounded-full bg-background/60 sm:block">
                      <span className="block h-full bg-primary" style={{ width: `${(r.total / MERIT_MAX) * 100}%` }} />
                    </span>
                    <span className="w-20 text-right text-sm"><b className="text-primary">{fmt(r.total)}</b> <span className="text-muted-foreground">pts</span></span>
                  </button>
                  {isOpen && <Bars row={r} className="px-3 py-3" />}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

function Bars({ row, className }: { row: MeritRow; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {MERIT_DOMAINS.map((d) => (
        <div key={d.key} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-2 text-xs">
          <span className="font-bold text-foreground">{d.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-background/60">
            <span className="block h-full bg-primary" style={{ width: `${row.scores[d.key]}%` }} />
          </span>
          <span className="text-right text-muted-foreground"><b className="text-foreground">{fmt(row.scores[d.key])}</b> · {fmt(row.raw[d.key])} brut</span>
        </div>
      ))}
    </div>
  );
}

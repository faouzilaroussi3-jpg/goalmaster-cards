import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Duel ranking by duel points (Elo). */
export function DuelLeaderboard({ limit = 50 }: { limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["duels", "leaderboard", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_duel_leaderboard", { _limit: limit });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (!data?.length) return <p className="text-muted-foreground">Aucun duel joué pour le moment. Sois le premier !</p>;
  return (
    <ol className="space-y-1.5">
      {data.map((row, i) => (
        <li key={row.user_id} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
          <span className={cn("w-7 font-display text-xl", i < 3 ? "text-gold" : "text-muted-foreground")}>{i + 1}</span>
          <span className="flex-1 truncate font-semibold">
            {row.username} <span className="text-xs text-muted-foreground">Niv. {row.level}</span>
          </span>
          <span className="hidden gap-3 text-xs text-muted-foreground sm:flex">
            <span>{row.wins} V</span><span>{row.draws} N</span><span>{row.losses} D</span>
          </span>
          <span className="font-display text-xl text-primary">{row.rating}</span>
        </li>
      ))}
    </ol>
  );
}

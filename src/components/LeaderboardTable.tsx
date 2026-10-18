import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "total", label: "Cartes", col: "total" },
  { key: "legendaries", label: "Légendaires", col: "legendaries" },
  { key: "shinies", label: "Shiny", col: "shinies" },
  { key: "ultimates", label: "Secrètes Ultimes", col: "ultimates" },
] as const;

export function LeaderboardTable({ limit = 50, compact }: { limit?: number; compact?: boolean }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("total");
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", sort, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { _sort: sort, _limit: limit });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
              sort === s.key ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : !data?.length ? (
        <p className="text-muted-foreground">Aucun collectionneur pour le moment.</p>
      ) : (
        <ol className="space-y-1.5">
          {data.map((row, i) => (
            <li key={row.user_id} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2">
              <span className={cn("w-7 font-display text-xl", i < 3 ? "text-gold" : "text-muted-foreground")}>{i + 1}</span>
              <span className="flex-1 truncate font-semibold">
                {row.username} <span className="text-xs text-muted-foreground">Niv. {row.level}</span>
              </span>
              {!compact && (
                <span className="hidden gap-4 text-xs text-muted-foreground sm:flex">
                  <span>{row.total} cartes</span>
                  <span>{row.legendaries} lég.</span>
                  <span>{row.shinies} shiny</span>
                  <span>{row.ultimates} SU</span>
                </span>
              )}
              <span className="font-display text-xl text-primary">{row[SORTS.find((s) => s.key === sort)!.col]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setRarities, type RarityRow } from "@/lib/rarity";

export const RARITIES_QUERY_KEY = ["rarities"] as const;

/** Loads the rarity list (built-in + admin-created) once and feeds it to the rarity registry used by every card. */
export function RarityRegistry() {
  const { data } = useQuery({
    queryKey: RARITIES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("rarities").select("key, label, short_label, tier, rank, effect, color, builtin").order("rank");
      if (error) throw error;
      return (data ?? []) as RarityRow[];
    },
    staleTime: 5 * 60_000,
  });
  useEffect(() => { if (data) setRarities(data); }, [data]);
  return null;
}

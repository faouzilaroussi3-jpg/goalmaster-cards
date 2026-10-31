import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Ceremony, CeremonyAward } from "@/lib/ballon-dor";
import type { AvatarRow } from "@/lib/avatar";

/** Every ceremony (newest first); AppHeader's realtime subscription invalidates ["ballon-dor"]. */
export function useCeremonies() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ballon-dor"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("ballon_dor_ceremonies").select("*").order("scheduled_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Ceremony[];
    },
  });
}

/** Avatar rows for a set of players (missing rows mean the default look). */
export function useAvatars(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["avatars", key],
    enabled: key.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("avatars").select("*").in("user_id", key);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.user_id, r as AvatarRow]));
    },
  });
}

/** Side trophies of every ceremony; shares the ["ballon-dor"] prefix so the same realtime invalidation refreshes it. */
export function useCeremonyAwards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ballon-dor", "awards"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("ceremony_awards").select("*").order("awarded_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as CeremonyAward[];
    },
  });
}

export interface TrophyLeaders {
  since: string; until: string;
  rarest: { user_id: string; username: string; card_name: string; rarity: string; rarity_label: string; version: string; rating: number; pulled_at: string }[];
  wins: { user_id: string; username: string; wins: number; played: number; goal_diff: number }[];
}

/** Admin only: this week's contenders for the side trophies (last 7 days, computed server-side). */
export function useTrophyLeaders(enabled = true) {
  return useQuery({
    queryKey: ["admin-weekly-trophies"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_weekly_trophies");
      if (error) throw error;
      return data as unknown as TrophyLeaders;
    },
  });
}

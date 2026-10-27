import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Ceremony } from "@/lib/ballon-dor";
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

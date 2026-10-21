import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Announcement } from "@/lib/news";

/** Latest news (last 60 days) plus when I last looked at them. */
export function useNews() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["news", uid],
    enabled: !!uid,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86400_000).toISOString();
      const [{ data: list, error }, { data: read }] = await Promise.all([
        supabase.from("announcements").select("*").gte("updated_at", since).order("updated_at", { ascending: false }).limit(12),
        supabase.from("announcement_reads").select("seen_at").eq("user_id", uid!).maybeSingle(),
      ]);
      if (error) throw error;
      return { list: (list ?? []) as Announcement[], seenAt: read?.seen_at ?? null };
    },
  });
}

/** A few of the best cards to show off on the welcome screen (Secrète Ultime stays hidden). */
export function useStarCards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["news-stars"],
    enabled: !!session,
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await supabase.from("cards").select("id, name, club, nationality, pos, rating, rarity, image_url, alt_image_url, has_alt")
        .eq("active", true).neq("rarity", "secret_ultimate").order("rating", { ascending: false }).limit(24)).data ?? [],
  });
}

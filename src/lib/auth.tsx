import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  session: Session | null;
  loading: boolean;
}
const Ctx = createContext<AuthCtx>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function useProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid!).single(),
        supabase.from("user_roles").select("role").eq("user_id", uid!),
      ]);
      return { ...profile!, isAdmin: !!roles?.some((r) => r.role === "admin") };
    },
  });
}

export function useMyPacks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["packs", session?.user.id],
    enabled: !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_packs");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyChallenges() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["challenges", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_challenges");
      if (error) throw error;
      return (data ?? []) as import("@/lib/challenges").Challenge[];
    },
  });
}

export function useMyPeriodicChallenges() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["challenges", "periodic", session?.user.id],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_periodic_challenges");
      if (error) throw error;
      return (data ?? []) as import("@/lib/periodic-challenges").PeriodicChallenge[];
    },
  });
}


export function useFriends() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["friends", session?.user.id],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_friends");
      if (error) throw error;
      return (data ?? []) as import("@/lib/friends").Friend[];
    },
  });
}

export interface MyDuel {
  duel_id: string; status: string; is_challenger: boolean; opponent_id: string | null; opponent_name: string | null;
  my_score: number; their_score: number; round: number; my_turn: boolean; they_played: boolean; incoming: boolean;
  open_invite: boolean; result: "win" | "loss" | "draw" | null; forfeit: boolean; my_reward: number | null;
  my_elo_delta: number | null; created_at: string; finished_at: string | null; round_started_at: string | null;
}

export function useMyDuels() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["duels", "mine", session?.user.id],
    enabled: !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_duels");
      if (error) throw error;
      return (data ?? []) as MyDuel[];
    },
  });
}

export interface MyMatch {
  match_id: string; status: string; is_home: boolean; opponent_id: string | null; opponent_name: string | null;
  my_goals: number; their_goals: number; needs_me: boolean; incoming: boolean; open_invite: boolean; they_ready: boolean;
  result: "win" | "loss" | "draw" | null; my_reward: number | null; my_elo_delta: number | null;
  my_general: number | null; their_general: number | null;
  created_at: string; halftime_at: string | null; finished_at: string | null;
}

export function useMyMatches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["matches", "mine", session?.user.id],
    enabled: !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_matches");
      if (error) throw error;
      return (data ?? []) as MyMatch[];
    },
  });
}

/** Steered matches (against the computer or a friend live): invites, games under way and recent results. */
export function useMyLiveMatches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["live-matches", session?.user.id],
    enabled: !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_live_matches");
      if (error) throw error;
      return (data ?? []) as import("@/lib/live-match").MyLiveMatch[];
    },
  });
}

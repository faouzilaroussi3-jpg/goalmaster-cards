import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Gamepad2, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriends, useMyLiveMatches } from "@/lib/auth";
import { splitFriends } from "@/lib/friends";
import { BOT_LEVEL_KEYS, BOT_LEVELS, botName, type BotLevel, type MyLiveMatch } from "@/lib/live-match";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<BotLevel, string> = { commune: "border-r-common/60", legendaire: "border-r-legendary/70", royal: "border-primary" };

/** "Jouer moi-même": steer your own pawns against the computer (3 levels) or a friend live. */
export function PlayYourself({ noTeam }: { noTeam: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const { data: live = [] } = useMyLiveMatches();
  const go = (id: string) => navigate({ to: "/matchs/direct/$matchId", params: { matchId: id } });

  const bot = useMutation({
    mutationFn: async (level: BotLevel) => {
      const { data, error } = await supabase.rpc("start_bot_match", { _level: level });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["live-matches"] }); go(id); },
    onError: (e: Error) => toast.error(e.message),
  });
  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = accept
        ? await supabase.rpc("accept_live_match", { _match_id: id })
        : await supabase.rpc("leave_live_match", { _match_id: id });
      if (error) throw error;
      return { id, accept };
    },
    onSuccess: ({ id, accept }) => { qc.invalidateQueries({ queryKey: ["live-matches"] }); if (accept) go(id); },
    onError: (e: Error) => toast.error(e.message),
  });

  const incoming = live.filter((m) => m.incoming);
  const ongoing = live.filter((m) => (m.status === "playing" || (m.status === "pending" && m.is_home)));
  const done = live.filter((m) => m.status === "finished").slice(0, 6);

  return (
    <section className="mt-8 rounded-2xl border border-primary/50 bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-3xl tracking-wide"><Gamepad2 className="h-6 w-6 text-primary" /> Jouer moi-même</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tu diriges tes pions : passe, passe en profondeur, centre et tir. Pour récupérer le ballon, passe sur le porteur ou maintiens Tir tout près de lui.
            Clavier, écran tactile ou manette. Victoire 150 pièces, défaite 30, nul 60 chacun (5 matchs récompensés par jour, tous modes confondus).
          </p>
        </div>
        <Button disabled={noTeam} onClick={() => setInviting(true)} className="h-auto bg-gold px-4 py-2.5 font-display text-lg text-primary-foreground shadow-gold">
          <Users className="h-4 w-4" /> Défier un ami en direct
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {BOT_LEVEL_KEYS.map((k) => (
          <button key={k} type="button" disabled={noTeam || bot.isPending} onClick={() => bot.mutate(k)}
            className={cn("rounded-xl border-2 bg-background/60 p-4 text-left transition hover:-translate-y-0.5 hover:bg-secondary disabled:opacity-50", LEVEL_TONE[k])}>
            <span className="flex items-center gap-2 font-display text-2xl tracking-wide"><Bot className="h-5 w-5 text-primary" /> Ordi {BOT_LEVELS[k].label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{BOT_LEVELS[k].hint}</span>
          </button>
        ))}
      </div>

      {(incoming.length > 0 || ongoing.length > 0 || done.length > 0) && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(incoming.length > 0 || ongoing.length > 0) && (
            <ul className="space-y-2">
              {incoming.map((m) => (
                <Row key={m.match_id} m={m} highlight status="te défie en direct"
                  action={<div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" disabled={respond.isPending} onClick={() => respond.mutate({ id: m.match_id, accept: false })}>Refuser</Button>
                    <Button size="sm" className="bg-gold text-primary-foreground" disabled={respond.isPending || noTeam} onClick={() => respond.mutate({ id: m.match_id, accept: true })}><Zap className="h-3.5 w-3.5" /> Jouer</Button>
                  </div>} />
              ))}
              {ongoing.map((m) => (
                <Row key={m.match_id} m={m} status={m.status === "pending" ? "invitation envoyée" : "match en cours"}
                  action={<Button asChild size="sm" variant="secondary"><Link to="/matchs/direct/$matchId" params={{ matchId: m.match_id }}>{m.status === "pending" ? "Voir" : "Reprendre"}</Link></Button>} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <ul className="space-y-2">
              {done.map((m) => (
                <Row key={m.match_id} m={m}
                  status={`${m.result === "win" ? "Victoire" : m.result === "loss" ? "Défaite" : "Nul"} · ${m.my_goals}-${m.their_goals}`}
                  action={<span className="text-xs font-bold text-primary">+{m.my_reward ?? 0}</span>} />
              ))}
            </ul>
          )}
        </div>
      )}

      <InviteDialog open={inviting} onClose={() => setInviting(false)} onCreated={go} />
    </section>
  );
}

function Row({ m, status, action, highlight }: { m: MyLiveMatch; status: string; action: ReactNode; highlight?: boolean }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-lg border bg-background/50 px-3 py-2", highlight ? "border-primary/70 shadow-gold" : "border-border")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{m.mode === "bot" ? botName(m.bot_level) : (m.opponent_name ?? "?")}</p>
        <p className="truncate text-xs text-muted-foreground">{status}</p>
      </div>
      {action}
    </li>
  );
}

function InviteDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: list = [] } = useFriends();
  const friends = splitFriends(list).friends;
  const invite = useMutation({
    mutationFn: async (friend: string) => {
      const { data, error } = await supabase.rpc("create_live_match", { _opponent: friend });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["live-matches"] }); onClose(); onCreated(id); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Défier un ami en direct</DialogTitle>
          <DialogDescription>Ton ami reçoit l'invitation tout de suite. Vous jouez en même temps, chacun dirige ses pions sur son appareil.</DialogDescription>
        </DialogHeader>
        {!friends.length ? (
          <p className="text-sm text-muted-foreground">Tu n'as pas encore d'ami. <Link to="/amis" className="text-primary">Ajoute des amis</Link> pour les défier.</p>
        ) : (
          <ul className="max-h-80 space-y-1.5 overflow-auto">
            {friends.map((f) => (
              <li key={f.user_id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{f.username} <span className="text-xs text-muted-foreground">niv. {f.level}</span></span>
                <Button size="sm" className="bg-gold text-primary-foreground" disabled={invite.isPending} onClick={() => invite.mutate(f.user_id)}>Défier</Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

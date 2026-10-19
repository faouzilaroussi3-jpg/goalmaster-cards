import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Globe, Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TeamPicker, type PickedCard } from "@/components/duel/TeamPicker";
import { cn } from "@/lib/utils";

export interface DuelTarget { id: string; username: string }

/** Create a duel: choose a player (or an open challenge), then a team of 5. */
export function NewDuelDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: DuelTarget | null }) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [target, setTarget] = useState<DuelTarget | "open" | null>(preset ?? null);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) { setTarget(preset ?? null); setQ(""); } }, [open, preset]);

  const { data: players = [] } = useQuery({
    queryKey: ["duel-players", q],
    enabled: open && target === null,
    queryFn: async () => {
      let req = supabase.from("profiles").select("id, username, level").neq("id", uid).order("level", { ascending: false }).limit(8);
      if (q.trim()) req = req.ilike("username", `%${q.trim()}%`);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (cards: PickedCard[]) => {
      const { data, error } = await supabase.rpc("create_duel", {
        _opponent: target === "open" || !target ? (null as unknown as string) : target.id,
        _user_card_ids: cards.map((c) => c.user_card_id),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      toast.success(target === "open" ? "Défi ouvert publié !" : `Défi envoyé à ${(target as DuelTarget).username} !`);
      qc.invalidateQueries({ queryKey: ["duels"] });
      onClose();
      navigate({ to: "/duels/$duelId", params: { duelId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wider">Nouveau duel</DialogTitle>
          <DialogDescription>
            {target === null ? "Choisis ton adversaire, ou lance un défi ouvert à tous." : "Compose ton équipe de 5 joueurs. Les 5 thèmes des manches seront tirés au sort."}
          </DialogDescription>
        </DialogHeader>

        {target === null ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setTarget("open")} className="flex items-center gap-3 rounded-xl border border-primary/60 bg-primary/10 p-3 text-left transition hover:bg-primary/20">
              <Globe className="h-6 w-6 text-primary" />
              <span>
                <span className="block font-semibold">Défi ouvert</span>
                <span className="text-xs text-muted-foreground">Le premier joueur qui accepte devient ton adversaire.</span>
              </span>
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Chercher un joueur par pseudo…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="space-y-1.5">
              {players.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setTarget({ id: p.id, username: p.username })} className={cn("flex w-full items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-left transition hover:bg-secondary")}>
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-semibold">{p.username}</span>
                    <span className="text-xs text-muted-foreground">Niv. {p.level}</span>
                  </button>
                </li>
              ))}
              {!players.length && <li className="text-sm text-muted-foreground">Aucun joueur trouvé.</li>}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
              <span>Adversaire : <b>{target === "open" ? "défi ouvert" : target.username}</b></span>
              {!preset && <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>Changer</Button>}
            </div>
            <TeamPicker submitLabel={target === "open" ? "Publier le défi" : "Envoyer le défi"} busy={create.isPending} onSubmit={(c) => create.mutate(c)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

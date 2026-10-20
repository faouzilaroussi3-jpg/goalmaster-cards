import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Globe, Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Challenge a player (or publish an open challenge) with the saved team. */
export function NewMatchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);

  const { data: players = [] } = useQuery({
    queryKey: ["match-players", q],
    enabled: open,
    queryFn: async () => {
      let req = supabase.from("profiles").select("id, username, level").neq("id", uid).order("level", { ascending: false }).limit(8);
      if (q.trim()) req = req.ilike("username", `%${q.trim()}%`);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (target: { id: string; username: string } | null) => {
      const { data, error } = await supabase.rpc("create_match", { _opponent: (target?.id ?? null) as unknown as string });
      if (error) throw error;
      return { id: data as string, target };
    },
    onSuccess: ({ id, target }) => {
      toast.success(target ? `Défi envoyé à ${target.username} !` : "Défi ouvert publié !");
      qc.invalidateQueries({ queryKey: ["matches"] });
      onClose();
      navigate({ to: "/matchs/$matchId", params: { matchId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wider">Nouveau match</DialogTitle>
          <DialogDescription>Ton équipe enregistrée affrontera celle de ton adversaire. Le match se joue dès qu'il accepte.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <button type="button" disabled={create.isPending} onClick={() => create.mutate(null)} className="flex items-center gap-3 rounded-xl border border-primary/60 bg-primary/10 p-3 text-left transition hover:bg-primary/20">
            <Globe className="h-6 w-6 text-primary" />
            <span>
              <span className="block font-semibold">Défi ouvert</span>
              <span className="text-xs text-muted-foreground">Le premier manager qui accepte devient ton adversaire.</span>
            </span>
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Chercher un joueur par pseudo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="space-y-1.5">
            {players.map((p) => (
              <li key={p.id}>
                <button type="button" disabled={create.isPending} onClick={() => create.mutate({ id: p.id, username: p.username })} className="flex w-full items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-left transition hover:bg-secondary">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate font-semibold">{p.username}</span>
                  <span className="text-xs text-muted-foreground">Niv. {p.level}</span>
                </button>
              </li>
            ))}
            {!players.length && <li className="text-sm text-muted-foreground">Aucun joueur trouvé.</li>}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

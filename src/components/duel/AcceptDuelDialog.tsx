import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Theme } from "@/lib/duel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TeamPicker, type PickedCard } from "@/components/duel/TeamPicker";

/** Accept an invitation or an open challenge by sending a team of 5. */
export function AcceptDuelDialog({ duel, onClose }: { duel: { id: string; challenger: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["duel", duel?.id],
    enabled: !!duel,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_duel", { _duel_id: duel!.id });
      if (error) throw error;
      return data as unknown as { themes: Theme[] };
    },
  });
  const accept = useMutation({
    mutationFn: async (cards: PickedCard[]) => {
      const { error } = await supabase.rpc("accept_duel", { _duel_id: duel!.id, _user_card_ids: cards.map((c) => c.user_card_id) });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Duel accepté, à toi de jouer !");
      qc.invalidateQueries({ queryKey: ["duels"] });
      qc.invalidateQueries({ queryKey: ["duel", duel!.id] });
      const id = duel!.id;
      onClose();
      navigate({ to: "/duels/$duelId", params: { duelId: id } });
    },
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["duels"] }); },
  });

  return (
    <Dialog open={!!duel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wider">Relever le défi de {duel?.challenger}</DialogTitle>
          <DialogDescription>Compose ton équipe en fonction des thèmes des 5 manches. Tu découvriras l'équipe adverse au début du duel.</DialogDescription>
        </DialogHeader>
        {duel && <TeamPicker themes={data?.themes} submitLabel="Accepter le duel" busy={accept.isPending} onSubmit={(c) => accept.mutate(c)} />}
      </DialogContent>
    </Dialog>
  );
}

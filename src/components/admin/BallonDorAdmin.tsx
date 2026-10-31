import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canCancel, canStart, type Ceremony } from "@/lib/ballon-dor";
import { useCeremonies, useCeremonyAwards } from "@/lib/ballon-dor-query";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const STATUS: Record<Ceremony["status"], string> = { scheduled: "Programmée", live: "En direct", finished: "Terminée", cancelled: "Annulée" };

/** Next Sunday 20:00 local time, as a datetime-local value. */
function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BallonDorAdmin() {
  const qc = useQueryClient();
  const { data: list = [] } = useCeremonies();
  const { data: awards = [] } = useCeremonyAwards();
  const [f, setF] = useState(() => ({ title: "Ballon d'Or de la semaine", at: nextSunday(), coins: 1000, trophyCoins: 500 }));
  const [busy, setBusy] = useState(false);

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await p;
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["ballon-dor"] });
    return true;
  }

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!f.at) return;
    await run(supabase.rpc("admin_schedule_ballon_dor", { _title: f.title, _at: new Date(f.at).toISOString(), _coins: f.coins, _trophy_coins: f.trophyCoins }), "Cérémonie programmée");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={schedule} className="panel grid gap-3 p-4 sm:grid-cols-[2fr_1.3fr_1fr_1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase text-muted-foreground">Titre</span>
          <input className={`${inp} w-full`} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase text-muted-foreground">Date et heure</span>
          <input className={`${inp} w-full`} type="datetime-local" required value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase text-muted-foreground">Pièces Ballon d'Or</span>
          <input className={`${inp} w-full`} type="number" min={0} max={1000000} value={f.coins} onChange={(e) => setF({ ...f, coins: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase text-muted-foreground">Pièces par trophée</span>
          <input className={`${inp} w-full`} type="number" min={0} max={1000000} value={f.trophyCoins} onChange={(e) => setF({ ...f, trophyCoins: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
        </label>
        <button disabled={busy} className="rounded-lg bg-gold px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">Programmer</button>
      </form>
      <p className="text-xs text-muted-foreground">
        Le jour J, ouvre la page <Link to="/ballon-dor" className="text-primary underline">Ballon d'Or</Link> : tu es sur scène, les joueurs connectés apparaissent dans la salle. Lance la cérémonie, remets d'abord le trophée de la carte la plus rare et celui des matchs gagnés (le gagnant est calculé tout seul, voir l'onglet Trophées de la semaine), puis désigne le Ballon d'Or.
      </p>
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="panel flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(c.scheduled_at).toLocaleString("fr-FR")} · {c.reward_coins} pièces (trophées : {c.trophy_coins ?? 500}) · {STATUS[c.status]}{c.winner_name ? ` · Ballon d'Or : ${c.winner_name}` : ""}
                {awards.filter((a) => a.ceremony_id === c.id).map((a) => ` · ${a.kind === "rarest_card" ? "Carte la plus rare" : "Matchs gagnés"} : ${a.winner_name}`).join("")}
              </div>
            </div>
            {canStart(c, list) && (
              <button type="button" disabled={busy} onClick={() => run(supabase.rpc("admin_start_ballon_dor", { _id: c.id }), "Cérémonie lancée")} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">Lancer</button>
            )}
            {canCancel(c) && (
              <button type="button" disabled={busy} onClick={() => { if (confirm("Annuler cette cérémonie ?")) run(supabase.rpc("admin_cancel_ballon_dor", { _id: c.id }), "Cérémonie annulée"); }} className="text-sm text-destructive">Annuler</button>
            )}
          </div>
        ))}
        {!list.length && <p className="text-sm text-muted-foreground">Aucune cérémonie pour l'instant.</p>}
      </div>
    </div>
  );
}

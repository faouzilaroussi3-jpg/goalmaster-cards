import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crown, Eye, Radio, Search, Shirt, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { sfx } from "@/lib/sfx";
import { lookFromRow } from "@/lib/avatar";
import { canAward, canCancel, canStart, countdown, currentCeremony, MAX_AUDIENCE, trophiesOf, type Ceremony } from "@/lib/ballon-dor";
import { useAvatars, useCeremonies } from "@/lib/ballon-dor-query";
import type { CeremonyView, Guest } from "@/components/avatar/CeremonyScene";

const CeremonyScene = lazy(() => import("@/components/avatar/CeremonyScene"));

export const Route = createFileRoute("/_authenticated/ballon-dor")({
  head: () => ({
    meta: [
      { title: "Cérémonie du Ballon d'Or — Goalmaster" },
      { name: "description", content: "Assiste en direct à la cérémonie hebdomadaire du Ballon d'Or avec les avatars des joueurs connectés." },
      { property: "og:title", content: "Cérémonie du Ballon d'Or — Goalmaster" },
      { property: "og:description", content: "Le meilleur joueur de la semaine reçoit son Ballon d'Or devant tout le monde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BallonDorPage,
});

interface Present { id: string; name: string; host: boolean; at: number }

/** Everyone on this page joins one presence room; the admin is drawn on stage, players in the stands. */
function usePresence(uid: string, name: string, host: boolean) {
  const [people, setPeople] = useState<Present[]>([]);
  useEffect(() => {
    if (!name) return;
    const channel = supabase.channel("ballon-dor-hall", { config: { presence: { key: uid } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Omit<Present, "id">>();
        const list: Present[] = Object.entries(state).map(([id, metas]) => ({ id, name: metas[0]?.name ?? "Joueur", host: !!metas[0]?.host, at: metas[0]?.at ?? 0 }));
        setPeople(list.sort((a, b) => a.at - b.at));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ name, host, at: Date.now() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [uid, name, host]);
  return people;
}

function BallonDorPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const { data: profile } = useProfile();
  const isAdmin = !!profile?.isAdmin;
  const { data: ceremonies = [] } = useCeremonies();
  const cur = currentCeremony(ceremonies);
  const people = usePresence(uid, profile?.username ?? "", isAdmin);
  const [view, setView] = useState<CeremonyView | null>(null);
  const viewNow: CeremonyView = view ?? (isAdmin ? "stage" : "hall");

  // Reveal: plays when the current ceremony goes from live to finished while the page is open.
  const [revealAt, setRevealAt] = useState<number | null>(null);
  const prev = useRef<{ id: string; status: string } | null>(null);
  useEffect(() => {
    if (!cur) return undefined;
    const p = prev.current;
    if (p && p.id === cur.id && p.status === "live" && cur.status === "finished") {
      setRevealAt(Date.now());
      sfx.drumroll(3.2);
      const t1 = setTimeout(() => sfx.fanfare(), 6300);
      const t2 = setTimeout(() => sfx.applause(3), 6600);
      prev.current = { id: cur.id, status: cur.status };
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prev.current = { id: cur.id, status: cur.status };
    return undefined;
  }, [cur]);
  const [revealText, setRevealText] = useState(false);
  useEffect(() => {
    if (!revealAt) { setRevealText(false); return; }
    const a = setTimeout(() => setRevealText(true), 3200);
    return () => clearTimeout(a);
  }, [revealAt]);

  const hostP = people.find((p) => p.host) ?? null;
  const crowd = people.filter((p) => p.id !== hostP?.id).slice(0, MAX_AUDIENCE);
  const winnerId = cur?.status === "finished" ? cur.winner_id : null;
  const ids = [...crowd.map((p) => p.id), ...(hostP ? [hostP.id] : []), ...(winnerId ? [winnerId] : [])];
  const { data: avatars } = useAvatars(ids);
  const guest = (id: string, name: string): Guest => ({ id, name, look: lookFromRow(avatars?.get(id)), trophies: trophiesOf(ceremonies, id).length });
  const audience = crowd.map((p) => guest(p.id, p.name));
  const host = hostP ? guest(hostP.id, hostP.name) : null;
  const winner = cur && winnerId ? guest(winnerId, cur.winner_name ?? "Gagnant") : null;
  const palmares = ceremonies.filter((c) => c.status === "finished");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl text-gold">Ballon d'Or</h1>
          <p className="text-sm text-muted-foreground">Chaque semaine, l'admin remet le Ballon d'Or au meilleur joueur, en direct devant tous les avatars connectés.</p>
        </div>
        <Link to="/avatar" className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground">
          <Shirt className="h-4 w-4 text-primary" /> Mon avatar
        </Link>
      </div>

      <div className="panel relative mt-4 h-[66vh] min-h-[420px] overflow-hidden p-0">
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Ouverture de la salle…</div>}>
          <CeremonyScene audience={audience} host={host} winner={winner} revealAt={revealAt} view={viewNow} myId={uid} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
          <StatusPill c={cur} now={now} />
          <div className="pointer-events-auto flex gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground"><Users className="h-3.5 w-3.5 text-primary" /> {people.length}</span>
            <button type="button" onClick={() => setView(viewNow === "stage" ? "hall" : "stage")} className="flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground">
              <Eye className="h-3.5 w-3.5 text-primary" /> {viewNow === "stage" ? "Vue salle" : "Vue scène"}
            </button>
          </div>
        </div>
        {winner && (revealText || !revealAt) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-muted-foreground">{cur?.title}</div>
            <div className={`font-display text-5xl text-gold sm:text-7xl ${revealAt ? "animate-in zoom-in-50 fade-in duration-700" : ""}`}>{winner.name}</div>
            {revealAt && <div className="text-sm font-bold text-foreground">+{cur?.reward_coins} pièces · trophée ajouté à sa vitrine</div>}
          </div>
        )}
        {revealAt && !revealText && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center font-display text-3xl tracking-widest text-foreground sm:text-5xl">
            Et le Ballon d'Or est attribué à…
          </div>
        )}
      </div>
      {people.length > MAX_AUDIENCE + 1 && <p className="mt-1 text-xs text-muted-foreground">{people.length - MAX_AUDIENCE - 1} autres joueurs regardent aussi.</p>}

      {isAdmin && <HostDesk list={ceremonies} cur={cur} present={crowd} hostId={hostP?.id ?? uid} />}

      <h2 className="mb-3 mt-8 text-3xl">Palmarès</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {palmares.map((c) => (
          <div key={c.id} className="panel flex items-center gap-3 p-3">
            <Crown className="h-6 w-6 shrink-0 text-gold" />
            <div className="min-w-0">
              <div className="truncate font-bold">{c.winner_name}{c.winner_id === uid ? " (toi)" : ""}</div>
              <div className="truncate text-xs text-muted-foreground">{c.title} · {new Date(c.awarded_at ?? c.scheduled_at).toLocaleDateString("fr-FR")}</div>
            </div>
          </div>
        ))}
        {!palmares.length && <p className="text-sm text-muted-foreground">Aucun Ballon d'Or remis pour l'instant.</p>}
      </div>
    </div>
  );
}

function StatusPill({ c, now }: { c: Ceremony | null; now: number }) {
  let text = "Aucune cérémonie programmée";
  if (c?.status === "live") text = "En direct · la cérémonie a commencé";
  else if (c?.status === "scheduled") text = `${c.title} · ${new Date(c.scheduled_at).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit", day: "numeric", month: "long" })} · dans ${countdown(new Date(c.scheduled_at).getTime() - now)}`;
  else if (c?.status === "finished") text = `${c.title} · terminée`;
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c?.status === "live" ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"}`}>
      {c?.status === "live" && <Radio className="h-3.5 w-3.5 animate-pulse" />} {text}
    </span>
  );
}

/** Admin controls inside the hall: launch, name the winner (players present first, or search anyone), cancel. */
function HostDesk({ list, cur, present, hostId }: { list: Ceremony[]; cur: Ceremony | null; present: Present[]; hostId: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: found = [] } = useQuery({
    queryKey: ["admin-players", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => (await supabase.rpc("admin_list_players", { _q: q.trim() })).data ?? [],
  });
  const candidates = useMemo(() => {
    const map = new Map<string, string>();
    present.forEach((p) => map.set(p.id, p.name));
    if (q.trim().length >= 2) found.forEach((p: { user_id: string; username: string }) => map.set(p.user_id, p.username));
    return [...map.entries()].filter(([id]) => id !== hostId || q.trim().length >= 2);
  }, [present, found, q, hostId]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { sfx.error(); toast.error(error.message); return; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["ballon-dor"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  if (!cur || cur.status === "finished" || cur.status === "cancelled") {
    return <div className="panel mt-4 p-4 text-sm text-muted-foreground">Programme la prochaine cérémonie dans Administration → Ballon d'Or.</div>;
  }
  return (
    <div className="panel mt-4 space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-2xl">Pupitre de l'admin</h2>
        {canStart(cur, list) && (
          <button type="button" disabled={busy} onClick={() => run(() => supabase.rpc("admin_start_ballon_dor", { _id: cur.id }), "La cérémonie est lancée !")}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Lancer la cérémonie</button>
        )}
        {canCancel(cur) && (
          <button type="button" disabled={busy} onClick={() => { if (confirm("Annuler cette cérémonie ?")) run(() => supabase.rpc("admin_cancel_ballon_dor", { _id: cur.id }), "Cérémonie annulée"); }}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-muted-foreground disabled:opacity-50">Annuler</button>
        )}
      </div>
      {cur.status === "scheduled" && <p className="text-sm text-muted-foreground">Les joueurs peuvent déjà entrer dans la salle. Lance la cérémonie quand tu es prêt, puis désigne le gagnant.</p>}
      {canAward(cur) && (
        <>
          <p className="text-sm text-muted-foreground">Choisis le Ballon d'Or : il reçoit {cur.reward_coins} pièces et le trophée rejoint sa vitrine.</p>
          <label className="flex items-center gap-2 rounded-lg border border-input bg-background/60 px-2 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un joueur absent…" className="w-full bg-transparent text-sm text-foreground outline-none" />
          </label>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map(([id, name]) => (
              <button key={id} type="button" disabled={busy} data-sfx="none"
                onClick={() => { if (confirm(`Remettre le Ballon d'Or à ${name} ?`)) run(() => supabase.rpc("admin_award_ballon_dor", { _id: cur.id, _winner: id }), `Ballon d'Or remis à ${name}`); }}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary disabled:opacity-50">
                <span className="truncate font-bold">{name}</span>
                <span className="text-xs text-primary">{present.some((p) => p.id === id) ? "présent · " : ""}Désigner</span>
              </button>
            ))}
            {!candidates.length && <p className="text-sm text-muted-foreground">Aucun joueur dans la salle pour l'instant.</p>}
          </div>
        </>
      )}
    </div>
  );
}

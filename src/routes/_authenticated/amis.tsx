import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, MessageCircle, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriends } from "@/lib/auth";
import { canSearch, splitFriends, type FoundPlayer, type Friend } from "@/lib/friends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/amis")({
  head: () => ({
    meta: [
      { title: "Amis — Goalmaster" },
      { name: "description", content: "Trouve d'autres collectionneurs Goalmaster, envoie et accepte des demandes d'ami." },
      { property: "og:title", content: "Amis — Goalmaster" },
      { property: "og:description", content: "Ajoute tes amis sur Goalmaster pour discuter et comparer vos collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function useDebounced(v: string, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function FriendsPage() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useFriends();
  const { friends, incoming, outgoing } = splitFriends(list);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());

  const search = useQuery({
    queryKey: ["player-search", dq],
    enabled: canSearch(dq),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_players", { _q: dq });
      if (error) throw error;
      return (data ?? []) as FoundPlayer[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["player-search"] });
  };
  const fail = (e: Error) => { toast.error(e.message); refresh(); };

  const add = useMutation({
    mutationFn: async (p: FoundPlayer) => {
      const { data, error } = await supabase.rpc("send_friend_request", { _to: p.user_id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (r, p) => {
      if (r === "accepted") { sfx.friendAccept(); toast.success(`${p.username} et toi êtes maintenant amis !`); }
      else { sfx.messageSend(); toast.success(`Demande envoyée à ${p.username}`); }
      refresh();
    },
    onError: fail,
  });
  const respond = useMutation({
    mutationFn: async ({ f, accept }: { f: Friend; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_friend_request", { _friendship_id: f.friendship_id, _accept: accept });
      if (error) throw error;
    },
    onSuccess: (_r, { f, accept }) => {
      if (accept) { sfx.friendAccept(); toast.success(`${f.username} est maintenant ton ami !`); }
      else { sfx.back(); toast(`Demande de ${f.username} refusée`); }
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (f: Friend) => {
      const { error } = await supabase.rpc("remove_friend", { _friendship_id: f.friendship_id });
      if (error) throw error;
    },
    onSuccess: (_r, f) => { sfx.back(); toast(f.status === "accepted" ? `${f.username} retiré de tes amis` : "Demande annulée"); refresh(); },
    onError: fail,
  });
  const busy = add.isPending || respond.isPending || remove.isPending;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-5xl text-gold">Amis</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Cherche un joueur par son pseudo pour l'ajouter. Une fois amis, vous pouvez discuter dans Messages.
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <label htmlFor="friend-search" className="mb-2 flex items-center gap-2 font-display text-2xl tracking-wide text-primary">
          <UserPlus className="h-5 w-5" /> Ajouter un ami
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="friend-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pseudo du joueur…" className="pl-9" maxLength={40} autoComplete="off" />
        </div>
        {canSearch(dq) && (
          <ul className="mt-3 space-y-2">
            {search.isLoading && <li className="text-sm text-muted-foreground">Recherche…</li>}
            {search.data?.length === 0 && <li className="text-sm text-muted-foreground">Aucun joueur trouvé.</li>}
            {search.data?.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
                <PlayerBadge name={p.username} level={p.level} />
                <div className="ml-auto">
                  {p.relation === "none" && (
                    <Button size="sm" data-sfx="none" disabled={busy} onClick={() => add.mutate(p)} className="bg-gold text-primary-foreground">
                      <UserPlus className="h-4 w-4" /> Ajouter
                    </Button>
                  )}
                  {p.relation === "received" && (
                    <Button size="sm" data-sfx="none" disabled={busy} onClick={() => add.mutate(p)} className="bg-gold text-primary-foreground">
                      <Check className="h-4 w-4" /> Accepter
                    </Button>
                  )}
                  {p.relation === "sent" && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Demande envoyée</span>}
                  {p.relation === "friends" && <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" /> Déjà amis</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isLoading && <p className="mt-8 text-center text-muted-foreground">Chargement…</p>}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-2xl tracking-wide text-primary">Demandes reçues {incoming.length > 0 && `(${incoming.length})`}</h2>
          {incoming.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>}
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 rounded-lg border border-primary/50 bg-background/60 p-3 shadow-[0_0_18px_-8px_var(--primary)]">
                <PlayerBadge name={f.username} level={f.level} />
                <div className="ml-auto flex gap-2">
                  <Button size="sm" data-sfx="none" disabled={busy} onClick={() => respond.mutate({ f, accept: true })} className="bg-gold text-primary-foreground">
                    <Check className="h-4 w-4" /> Accepter
                  </Button>
                  <Button size="icon" variant="secondary" data-sfx="none" disabled={busy} onClick={() => respond.mutate({ f, accept: false })} aria-label={`Refuser la demande de ${f.username}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-2xl tracking-wide text-muted-foreground">Demandes envoyées</h2>
          {outgoing.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
                <PlayerBadge name={f.username} level={f.level} />
                <Button size="sm" variant="secondary" data-sfx="none" disabled={busy} onClick={() => remove.mutate(f)} className="ml-auto">
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide text-primary">
          <Users className="h-5 w-5" /> Mes amis ({friends.length})
        </h2>
        {friends.length === 0 && <p className="text-sm text-muted-foreground">Tu n'as pas encore d'amis. Utilise la recherche ci-dessus pour en ajouter.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {friends.map((f) => (
            <li key={f.friendship_id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
              <PlayerBadge name={f.username} level={f.level} />
              <div className="ml-auto flex gap-2">
                <Button asChild size="sm" className="bg-gold text-primary-foreground">
                  <Link to="/messages" search={{ ami: f.user_id }}>
                    <MessageCircle className="h-4 w-4" /> Message
                    {f.unread > 0 && <span className="rounded-full bg-background px-1.5 text-[10px] text-primary">{f.unread}</span>}
                  </Link>
                </Button>
                <Button
                  size="icon" variant="secondary" data-sfx="none" disabled={busy} aria-label={`Retirer ${f.username} de mes amis`}
                  onClick={() => { if (window.confirm(`Retirer ${f.username} de tes amis ?`)) remove.mutate(f); }}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function PlayerBadge({ name, level }: { name: string; level: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-lg text-primary">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">Niveau {level}</p>
      </div>
    </div>
  );
}

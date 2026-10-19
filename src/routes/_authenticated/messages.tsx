import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Send, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useFriends } from "@/lib/auth";
import { cleanMessage, MESSAGE_MAX, shortTime, splitFriends, type Friend } from "@/lib/friends";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s: Record<string, unknown>): { ami?: string } =>
    typeof s["ami"] === "string" && UUID.test(s["ami"]) ? { ami: s["ami"] } : {},
  head: () => ({
    meta: [
      { title: "Messages — Goalmaster" },
      { name: "description", content: "Discute en privé avec tes amis Goalmaster en temps réel." },
      { property: "og:title", content: "Messages — Goalmaster" },
      { property: "og:description", content: "La messagerie privée entre amis collectionneurs de Goalmaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

interface Msg { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }

function MessagesPage() {
  const { ami } = Route.useSearch();
  const { data: list = [], isLoading } = useFriends();
  const { friends } = splitFriends(list);
  const current = friends.find((f) => f.user_id === ami) ?? null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-6xl flex-col px-4 py-4 2xl:h-[calc(100dvh-4.5rem)]">
      <h1 className={cn("text-4xl text-gold", current && "hidden md:block")}>Messages</h1>
      <div className="mt-3 flex min-h-0 flex-1 gap-4">
        <aside className={cn("flex min-h-0 w-full flex-col rounded-xl border border-border bg-card md:w-72 md:shrink-0", current && "hidden md:flex")}>
          <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversations</p>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading && <li className="p-3 text-sm text-muted-foreground">Chargement…</li>}
            {!isLoading && friends.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                Ajoute des amis pour commencer à discuter.
                <Button asChild size="sm" className="mt-3 w-full bg-gold text-primary-foreground">
                  <Link to="/amis"><UserPlus className="h-4 w-4" /> Trouver des amis</Link>
                </Button>
              </li>
            )}
            {friends.map((f) => (
              <li key={f.friendship_id}>
                <Link
                  to="/messages"
                  search={{ ami: f.user_id }}
                  className={cn("flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-secondary", f.user_id === ami && "bg-secondary")}
                >
                  <Avatar name={f.username} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{f.username}</p>
                      {f.last_at && <span className="shrink-0 text-[10px] text-muted-foreground">{shortTime(f.last_at)}</span>}
                    </div>
                    <p className={cn("truncate text-xs", f.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {f.last_message ? `${f.last_from_me ? "Toi : " : ""}${f.last_message}` : "Dis bonjour 👋"}
                    </p>
                  </div>
                  {f.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{f.unread}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section className={cn("min-h-0 flex-1 flex-col rounded-xl border border-border bg-card", current ? "flex" : "hidden md:flex")}>
          {current ? (
            <Conversation key={current.user_id} friend={current} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 text-primary" />
              <p>{ami && !isLoading ? "Cette personne n'est pas (ou plus) dans tes amis." : "Choisis un ami pour discuter."}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Conversation({ friend }: { friend: Friend }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [], isLoading } = useQuery({
    queryKey: ["messages", friend.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${friend.user_id}),and(sender_id.eq.${friend.user_id},recipient_id.eq.${me})`)
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return ((data ?? []) as Msg[]).reverse();
    },
  });

  // Opening the conversation (or receiving a message while it is open) marks it read.
  const unreadHere = msgs.some((m) => m.sender_id === friend.user_id && !m.read_at);
  useEffect(() => {
    if (!unreadHere) return;
    void supabase.rpc("mark_messages_read", { _from: friend.user_id }).then(() => qc.invalidateQueries({ queryKey: ["friends"] }));
  }, [unreadHere, friend.user_id, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc("send_message", { _to: friend.user_id, _body: body });
      if (error) throw error;
    },
    onMutate: () => setText(""),
    onSuccess: () => {
      sfx.messageSend();
      qc.invalidateQueries({ queryKey: ["messages", friend.user_id] });
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (e: Error, body) => { setText(body); toast.error(e.message); },
  });

  const clean = cleanMessage(text);
  const submit = () => { if (clean && !send.isPending) send.mutate(clean); };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <button type="button" aria-label="Retour aux conversations" onClick={() => navigate({ to: "/messages", search: {} })} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={friend.username} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{friend.username}</p>
          <p className="text-xs text-muted-foreground">Niveau {friend.level}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {isLoading && <p className="text-center text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && msgs.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">Aucun message. Lance la discussion avec {friend.username} !</p>
        )}
        {msgs.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = msgs[i - 1];
          const gap = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 10 * 60_000;
          return (
            <div key={m.id}>
              {gap && <p className="my-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">{shortTime(m.created_at)}</p>}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground",
                  )}
                  title={new Date(m.created_at).toLocaleString("fr-FR")}
                >
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
        {msgs.at(-1)?.sender_id === me && msgs.at(-1)?.read_at && (
          <p className="pr-1 text-right text-[10px] text-muted-foreground">Vu</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <div className="relative flex-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Écris à ${friend.username}…`}
            aria-label={`Message pour ${friend.username}`}
            rows={1}
            maxLength={MESSAGE_MAX + 50}
            className="max-h-32 min-h-10 resize-none pr-14"
          />
          {text.length > MESSAGE_MAX - 80 && (
            <span className={cn("absolute bottom-2 right-3 text-[10px]", text.trim().length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground")}>
              {text.trim().length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
        <Button type="submit" size="icon" data-sfx="none" disabled={!clean || send.isPending} aria-label="Envoyer" className="h-10 w-10 shrink-0 bg-gold text-primary-foreground">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-lg text-primary">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Gift, Loader2, Package, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rarityMeta } from "@/lib/rarity";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import {
  MAX_COINS_PER_SEND, MAX_COPIES_PER_SEND, MAX_PACKS_PER_SEND, NOTE_MAX,
  giftError, giftSummary, type GiftForm, type GiftVersion,
} from "@/lib/admin-grants";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const chip = "rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground hover:bg-primary hover:text-primary-foreground";

type FoundCard = { id: string; name: string; club: string; rarity: string; rating: number; has_alt: boolean; has_shiny: boolean };

const EMPTY: Omit<GiftForm, "allPlayers" | "userId"> = { packKey: "", packs: 0, coins: 0, cardId: null, version: "normal", copies: 0, note: "" };

export function GiftsAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [allPlayers, setAllPlayers] = useState(false);
  const [player, setPlayer] = useState<{ id: string; username: string } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [cardQ, setCardQ] = useState("");
  const [card, setCard] = useState<FoundCard | null>(null);
  const [sending, setSending] = useState(false);

  const { data: players = [], isFetching: loadingPlayers } = useQuery({
    queryKey: ["admin-players", q.trim()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_players", { _q: q.trim() });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: packTypes = [] } = useQuery({
    queryKey: ["admin-gift-packs"],
    queryFn: async () => (await supabase.from("pack_types").select("key, name").order("sort_order")).data ?? [],
  });
  const { data: cards = [] } = useQuery({
    queryKey: ["admin-gift-cards", cardQ.trim()],
    enabled: cardQ.trim().length >= 2,
    queryFn: async () =>
      ((await supabase.from("cards").select("id, name, club, rarity, rating, has_alt, has_shiny")
        .ilike("name", `%${cardQ.trim()}%`).order("rating", { ascending: false }).limit(8)).data ?? []) as FoundCard[],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["admin-gift-history"],
    queryFn: async () =>
      (await supabase.from("admin_grants")
        .select("id, packs, coins, card_version, card_copies, note, created_at, profiles!admin_grants_user_id_fkey(username), pack_types(name), cards(name)")
        .order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const packKey = form.packKey || packTypes[0]?.key || "";
  const full: GiftForm = { ...form, packKey, allPlayers, userId: player?.id ?? null, cardId: card?.id ?? null };
  const error = giftError(full, card);
  const set = (o: Partial<typeof form>) => setForm((f) => ({ ...f, ...o }));
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  async function send() {
    if (error) { toast.error(error); return; }
    if (allPlayers && !window.confirm(`Envoyer ce cadeau à TOUS les joueurs (${players.length >= 100 ? "100+" : players.length}) ?`)) return;
    setSending(true);
    const { data, error: err } = await supabase.rpc("admin_grant", {
      _user_id: (allPlayers ? null : player?.id ?? null) as string,
      _all: allPlayers,
      _pack_key: packKey,
      _packs: full.packs,
      _coins: full.coins,
      _card_id: (full.copies > 0 ? card?.id ?? null : null) as string,
      _version: full.version,
      _copies: full.copies,
      _note: full.note.trim(),
    });
    setSending(false);
    if (err) { sfx.error(); toast.error(err.message); return; }
    sfx.coins(5);
    const summary = giftSummary({
      pack_name: packTypes.find((p) => p.key === packKey)?.name ?? null, packs: full.packs, coins: full.coins,
      card_name: card?.name ?? null, card_version: full.version, card_copies: full.copies,
    });
    toast.success(allPlayers ? `Cadeau envoyé à ${data} joueurs` : `Cadeau envoyé à ${player?.username}`, { description: summary });
    setForm({ ...EMPTY, packKey });
    setCard(null);
    setCardQ("");
    qc.invalidateQueries({ queryKey: ["admin-players"] });
    qc.invalidateQueries({ queryKey: ["admin-gift-history"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* Who */}
      <section className="panel space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-2xl"><Users className="h-5 w-5 text-primary" /> Joueur</h3>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allPlayers} onChange={(e) => setAllPlayers(e.target.checked)} />
          Envoyer à tous les joueurs
        </label>
        {!allPlayers && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inp} w-full pl-9`} placeholder="Rechercher un pseudo" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {loadingPlayers && players.length === 0 && <li className="p-2 text-sm text-muted-foreground">Chargement…</li>}
              {!loadingPlayers && players.length === 0 && <li className="p-2 text-sm text-muted-foreground">Aucun joueur trouvé.</li>}
              {players.map((p) => (
                <li key={p.user_id}>
                  <button
                    onClick={() => setPlayer({ id: p.user_id, username: p.username })}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                      player?.id === p.user_id ? "bg-primary text-primary-foreground" : "bg-secondary/60 hover:bg-secondary",
                    )}
                  >
                    <span className="min-w-0 truncate font-bold">{p.username}{p.is_admin && <span className="ml-1 text-xs opacity-70">(admin)</span>}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs opacity-80">
                      Niv. {p.level}
                      <span className="flex items-center gap-0.5"><Coins className="h-3 w-3" />{p.coins.toLocaleString("fr-FR")}</span>
                      <span className="flex items-center gap-0.5"><Package className="h-3 w-3" />{Number(p.total_packs)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* What */}
      <section className="panel space-y-4 p-4">
        <h3 className="flex items-center gap-2 text-2xl">
          <Gift className="h-5 w-5 text-primary" /> Cadeau pour {allPlayers ? "tous les joueurs" : player ? <span className="text-primary">{player.username}</span> : "…"}
        </h3>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Packs</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className={inp} value={packKey} onChange={(e) => set({ packKey: e.target.value })}>
              {packTypes.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <input aria-label="Nombre de packs" className={`${inp} w-28`} type="number" min={0} max={MAX_PACKS_PER_SEND} value={form.packs} onChange={(e) => set({ packs: num(e.target.value) })} />
            {[1, 5, 10, 50].map((n) => <button key={n} type="button" className={chip} onClick={() => set({ packs: form.packs + n })}>+{n}</button>)}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Pièces</p>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Nombre de pièces" className={`${inp} w-36`} type="number" min={0} max={MAX_COINS_PER_SEND} value={form.coins} onChange={(e) => set({ coins: num(e.target.value) })} />
            {[100, 1000, 10000, 100000].map((n) => <button key={n} type="button" className={chip} onClick={() => set({ coins: form.coins + n })}>+{n.toLocaleString("fr-FR")}</button>)}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Carte (facultatif)</p>
          {card ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                <b>{card.name}</b> <span className="text-muted-foreground">{rarityMeta(card.rarity)?.label} · {card.rating}</span>
                <button aria-label="Retirer la carte" onClick={() => { setCard(null); set({ copies: 0, version: "normal" }); }}><X className="h-4 w-4" /></button>
              </span>
              <select aria-label="Version" className={inp} value={form.version} onChange={(e) => set({ version: e.target.value as GiftVersion })}>
                <option value="normal">Normale</option>
                {card.has_alt && <option value="alt">ALT</option>}
                {card.has_shiny && <option value="shiny">Shiny</option>}
              </select>
              <label className="flex items-center gap-1 text-sm">
                Exemplaires
                <input className={`${inp} w-20`} type="number" min={1} max={MAX_COPIES_PER_SEND} value={form.copies} onChange={(e) => set({ copies: num(e.target.value) })} />
              </label>
            </div>
          ) : (
            <div className="relative">
              <input className={`${inp} w-full`} placeholder="Rechercher une carte par nom" value={cardQ} onChange={(e) => setCardQ(e.target.value)} />
              {cardQ.trim().length >= 2 && (
                <ul className="mt-1 space-y-1">
                  {cards.length === 0 && <li className="p-2 text-sm text-muted-foreground">Aucune carte.</li>}
                  {cards.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => { setCard(c); set({ copies: Math.max(1, form.copies), version: "normal" }); }} className="flex w-full justify-between rounded-lg bg-secondary/60 px-3 py-1.5 text-left text-sm hover:bg-secondary">
                        <span><b>{c.name}</b> <span className="text-muted-foreground">{c.club}</span></span>
                        <span className="text-xs text-muted-foreground">{rarityMeta(c.rarity)?.label} · {c.rating}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase text-muted-foreground">Message au joueur (facultatif)</p>
          <input className={`${inp} w-full`} maxLength={NOTE_MAX} placeholder="Ex. : Merci pour ta fidélité !" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </div>

        <p className="text-xs text-muted-foreground">
          Envoie autant de fois que tu veux. Par envoi : jusqu'à {MAX_PACKS_PER_SEND.toLocaleString("fr-FR")} packs, {MAX_COINS_PER_SEND.toLocaleString("fr-FR")} pièces et {MAX_COPIES_PER_SEND} exemplaires de carte. Les packs offerts peuvent dépasser le stock max.
        </p>
        <button onClick={send} disabled={!!error || sending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-bold text-primary-foreground disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          {error && error !== "Rien à envoyer" ? error : "Envoyer le cadeau"}
        </button>
      </section>

      {/* History */}
      <section className="panel p-4 lg:col-span-2">
        <h3 className="mb-2 text-2xl">Derniers cadeaux envoyés</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun cadeau pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{h.profiles?.username ?? "?"}</b> — {giftSummary({ pack_name: h.pack_types?.name ?? null, packs: h.packs, coins: h.coins, card_name: h.cards?.name ?? null, card_version: h.card_version, card_copies: h.card_copies })}
                  {h.note && <span className="text-muted-foreground"> « {h.note} »</span>}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

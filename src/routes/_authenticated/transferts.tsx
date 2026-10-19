import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Coins, Gavel, Plus, Search, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { rarityMeta, useRarities, VERSION_LABEL } from "@/lib/rarity";
import { AUCTION_DURATIONS, bidCost, formatTimeLeft, MIN_START_PRICE, minBid, sellerPayout, TRANSFER_TAX } from "@/lib/transfer-market";
import { PlayerCard } from "@/components/PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/transferts")({
  head: () => ({
    meta: [
      { title: "Transferts — Goalmaster" },
      { name: "description", content: "Le marché des transferts : mets tes cartes aux enchères et enchéris sur celles des autres joueurs." },
      { property: "og:title", content: "Transferts — Goalmaster" },
      { property: "og:description", content: "Enchères de cartes de football entre joueurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersPage,
});

type Scope = "market" | "selling" | "bidding";
interface Auction {
  auction_id: string; card_id: string; name: string; club: string; nationality: string; pos: string; rating: number;
  rarity: string; tier: number; image_url: string | null; version: string;
  seller_name: string | null; is_mine: boolean; start_price: number; current_bid: number | null; bidder_name: string | null;
  i_lead: boolean; i_bid: boolean; bid_count: number; min_bid: number; ends_at: string;
  status: string; seller_received: number | null; created_at: string;
}

function useAuctions(scope: Scope) {
  return useQuery({
    queryKey: ["auctions", scope],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_auctions", { _scope: scope });
      if (error) throw error;
      return (data ?? []) as Auction[];
    },
  });
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const asCard = (a: Auction) => ({ ...a, id: a.card_id, alt_image_url: a.version === "alt" ? a.image_url : null });

function TransfersPage() {
  const [scope, setScope] = useState<Scope>("market");
  const [selling, setSelling] = useState(false);
  const [bidding, setBidding] = useState<Auction | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl text-gold">Transferts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mets tes cartes aux enchères et enchéris sur celles des autres joueurs. Le meilleur enchérisseur gagne la carte à la fin du temps.
          </p>
        </div>
        <Button onClick={() => setSelling(true)} className="h-auto bg-gold px-5 py-2.5 font-display text-lg text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4" /> Vendre une carte
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {([
          ["market", "Marché"],
          ["selling", "Mes ventes"],
          ["bidding", "Mes enchères"],
        ] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-bold", scope === k ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {scope === "market" ? <Market onBid={setBidding} /> : <MyList scope={scope} onBid={setBidding} />}

      <SellDialog open={selling} onClose={() => setSelling(false)} onListed={() => setScope("selling")} />
      <BidDialog auction={bidding} onClose={() => setBidding(null)} />
    </div>
  );
}

function Market({ onBid }: { onBid: (a: Auction) => void }) {
  const rarities = useRarities();
  const { data = [], isLoading } = useAuctions("market");
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<"ending" | "price_asc" | "price_desc" | "rating">("ending");
  const sel = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
  const price = (a: Auction) => a.current_bid ?? a.start_price;

  const list = data
    .filter((a) => !q || `${a.name} ${a.club} ${a.nationality}`.toLowerCase().includes(q.toLowerCase()))
    .filter((a) => !rarity || a.rarity === rarity)
    .sort((a, b) =>
      sort === "price_asc" ? price(a) - price(b)
      : sort === "price_desc" ? price(b) - price(a)
      : sort === "rating" ? b.rating - a.rating
      : new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className={cn(sel, "pl-8")} placeholder="Joueur, club, pays…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className={sel} value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rareté">
          <option value="">Toutes raretés</option>
          {rarities.filter((r) => r.key !== "secret_ultimate").map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier">
          <option value="ending">Fin la plus proche</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="rating">Meilleure note</option>
        </select>
      </div>
      {isLoading ? <p className="mt-6 text-muted-foreground">Chargement du marché…</p>
        : !list.length ? <p className="mt-6 text-muted-foreground">{data.length ? "Aucune enchère ne correspond." : "Aucune carte en vente pour l'instant. Sois le premier à vendre une carte !"}</p>
        : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {list.map((a) => <AuctionTile key={a.auction_id} a={a} onBid={onBid} />)}
          </div>
        )}
    </>
  );
}

function MyList({ scope, onBid }: { scope: "selling" | "bidding"; onBid: (a: Auction) => void }) {
  const { data = [], isLoading } = useAuctions(scope);
  if (isLoading) return <p className="mt-6 text-muted-foreground">Chargement…</p>;
  if (!data.length)
    return <p className="mt-6 text-muted-foreground">{scope === "selling" ? "Tu n'as encore rien mis en vente." : "Tu n'as encore enchéri sur aucune carte."}</p>;
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {data.map((a) => <AuctionTile key={a.auction_id} a={a} onBid={onBid} />)}
    </div>
  );
}

function statusOf(a: Auction, ended: boolean): { label: string; tone: "lead" | "warn" | "done" | "muted" } | null {
  if (a.status === "active" && !ended) {
    if (a.is_mine) return a.bid_count ? { label: "En vente", tone: "lead" } : { label: "Aucune enchère", tone: "muted" };
    if (a.i_lead) return { label: "Tu es en tête", tone: "lead" };
    if (a.i_bid) return { label: "Enchère dépassée", tone: "warn" };
    return null;
  }
  if (a.status === "cancelled") return { label: "Annulée", tone: "muted" };
  if (a.is_mine) {
    if (a.status === "sold") return { label: `Vendue · +${a.seller_received ?? sellerPayout(a.current_bid ?? 0)}`, tone: "done" };
    if (a.status === "expired") return { label: "Non vendue · rendue", tone: "muted" };
    return { label: "Terminée", tone: "muted" };
  }
  if (a.i_lead) return { label: "Gagnée !", tone: "done" };
  if (a.i_bid) return { label: "Perdue · pièces rendues", tone: "muted" };
  return { label: "Terminée", tone: "muted" };
}

function AuctionTile({ a, onBid }: { a: Auction; onBid: (a: Auction) => void }) {
  const now = useNow();
  const qc = useQueryClient();
  const left = new Date(a.ends_at).getTime() - now;
  const ended = left <= 0 || a.status !== "active";
  const st = statusOf(a, ended);
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_auction", { _auction_id: a.auction_id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Vente annulée, la carte reste dans ta collection."); qc.invalidateQueries({ queryKey: ["auctions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="panel flex flex-col gap-2 p-2">
      <div className="relative">
        <PlayerCard card={asCard(a)} />
        {st && (
          <span className={cn("absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            st.tone === "lead" && "bg-primary text-primary-foreground",
            st.tone === "warn" && "bg-destructive text-destructive-foreground",
            st.tone === "done" && "bg-gold text-primary-foreground",
            st.tone === "muted" && "bg-secondary text-muted-foreground")}>
            {st.label}
          </span>
        )}
      </div>
      <div className="px-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{a.current_bid != null ? "Enchère actuelle" : "Prix de départ"}</span>
          <span className="flex items-center gap-1 font-display text-lg text-primary"><Coins className="h-3.5 w-3.5" />{a.current_bid ?? a.start_price}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /><span className={cn(!ended && left < 5 * 60_000 && "font-bold text-destructive")}>{ended ? "Terminée" : formatTimeLeft(left)}</span></span>
          <span>{a.bid_count} enchère{a.bid_count > 1 ? "s" : ""}</span>
        </div>
        <div className="mt-0.5 truncate text-muted-foreground">
          {a.is_mine ? "Ta carte" : `Vendeur : ${a.seller_name ?? "?"}`}
          {a.bidder_name && !a.is_mine && a.current_bid != null && ` · En tête : ${a.i_lead ? "toi" : a.bidder_name}`}
          {a.bidder_name && a.is_mine && ` · En tête : ${a.bidder_name}`}
        </div>
      </div>
      {!ended && !a.is_mine && (
        <Button size="sm" onClick={() => onBid(a)} className={cn(a.i_lead ? "bg-secondary text-foreground" : "bg-gold text-primary-foreground")}>
          <Gavel className="h-4 w-4" /> {a.i_lead ? "Monter mon enchère" : a.i_bid ? "Relancer" : "Enchérir"}
        </Button>
      )}
      {!ended && a.is_mine && a.bid_count === 0 && (
        <Button size="sm" variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          <X className="h-4 w-4" /> Annuler la vente
        </Button>
      )}
    </div>
  );
}

function BidDialog({ auction, onClose }: { auction: Auction | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: market = [] } = useAuctions("market");
  // Follow the live auction so the minimum stays right if someone else bids meanwhile.
  const a = auction ? market.find((m) => m.auction_id === auction.auction_id) ?? auction : null;
  const min = a ? minBid(a.start_price, a.current_bid) : 0;
  const [amount, setAmount] = useState("");
  useEffect(() => { if (auction) setAmount(String(minBid(auction.start_price, auction.current_bid))); }, [auction]);
  const now = useNow();

  const value = Number(amount);
  const cost = a ? bidCost(value, a.current_bid, a.i_lead) : 0;
  const coins = profile?.coins ?? 0;
  const invalid = !Number.isInteger(value) || value < min;
  const broke = cost > coins;

  const bid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("place_bid", { _auction_id: a!.auction_id, _amount: value });
      if (error) throw error;
    },
    onSuccess: () => {
      sfx.gavel();
      toast.success(`Enchère de ${value} pièces placée !`);
      qc.invalidateQueries({ queryKey: ["auctions"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      onClose();
    },
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["auctions"] }); },
  });

  return (
    <Dialog open={!!auction} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-3xl tracking-wider">Enchérir</DialogTitle>
              <DialogDescription>
                {a.name} · {rarityMeta(a.rarity).label}{a.version !== "normal" && ` ${VERSION_LABEL[a.version]}`} · vendue par {a.seller_name ?? "?"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4">
              <div className="w-32 shrink-0"><PlayerCard card={asCard(a)} /></div>
              <div className="flex flex-1 flex-col gap-1.5 text-sm">
                <Row label={a.current_bid != null ? "Enchère actuelle" : "Prix de départ"} value={`${a.current_bid ?? a.start_price} pièces`} />
                <Row label="Enchère minimum" value={`${min} pièces`} />
                <Row label="Temps restant" value={formatTimeLeft(new Date(a.ends_at).getTime() - now)} />
                <Row label="Tes pièces" value={`${coins}`} />
              </div>
            </div>
            <form className="mt-2 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!invalid && !broke) bid.mutate(); }}>
              <label className="text-sm font-semibold" htmlFor="bid-amount">Ton enchère</label>
              <Input id="bid-amount" type="number" inputMode="numeric" min={min} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {[min, Math.ceil(min * 1.1), Math.ceil(min * 1.25)].filter((v, i, arr) => arr.indexOf(v) === i).map((v) => (
                  <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">{v}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Les pièces sont bloquées tout de suite{a.i_lead ? " (seule la différence avec ton enchère actuelle)" : ""}. Si quelqu'un enchérit plus haut, elles te sont rendues.
                Une enchère dans les 2 dernières minutes prolonge la vente de 2 minutes.
              </p>
              {invalid && amount !== "" && <p className="text-xs font-bold text-destructive">L'enchère minimum est de {min} pièces.</p>}
              {!invalid && broke && <p className="text-xs font-bold text-destructive">Il te manque {cost - coins} pièces.</p>}
              <Button type="submit" disabled={invalid || broke || bid.isPending} className="bg-gold text-primary-foreground">
                <Gavel className="h-4 w-4" /> Enchérir {Number.isFinite(value) && value > 0 ? `${value} pièces` : ""}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

interface OwnedCopy {
  id: string;
  version: string;
  cards: { id: string; name: string; club: string; nationality: string; pos: string; rating: number; rarity: string; image_url: string | null; alt_image_url: string | null } | null;
}

function SellDialog({ open, onClose, onListed }: { open: boolean; onClose: () => void; onListed: () => void }) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const { data: copies = [] } = useQuery({
    queryKey: ["my-copies", uid],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_cards").select("id, version, cards(id, name, club, nationality, pos, rating, rarity, image_url, alt_image_url)").eq("user_id", uid);
      if (error) throw error;
      return (data ?? []) as unknown as OwnedCopy[];
    },
  });
  const { data: listed = [] } = useQuery({
    queryKey: ["my-listed", uid],
    enabled: open,
    queryFn: async () => (await supabase.rpc("get_my_listed_copies")).data?.map((r) => r.user_card_id) ?? [],
  });

  // One entry per card + version, with the copies still free to sell.
  const groups = useMemo(() => {
    const taken = new Set(listed);
    const m = new Map<string, { card: NonNullable<OwnedCopy["cards"]>; version: string; total: number; free: string[] }>();
    for (const c of copies) {
      if (!c.cards || c.cards.rarity === "secret_ultimate") continue;
      const k = `${c.cards.id}:${c.version}`;
      const g = m.get(k) ?? { card: c.cards, version: c.version, total: 0, free: [] };
      g.total += 1;
      if (!taken.has(c.id)) g.free.push(c.id);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => rarityMeta(b.card.rarity).tier - rarityMeta(a.card.rarity).tier || b.card.rating - a.card.rating);
  }, [copies, listed]);

  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [price, setPrice] = useState("100");
  const [hours, setHours] = useState<number>(24);
  useEffect(() => { if (!open) { setPicked(null); setQ(""); } }, [open]);
  const group = groups.find((g) => `${g.card.id}:${g.version}` === picked);
  const p = Number(price);
  const badPrice = !Number.isInteger(p) || p < MIN_START_PRICE;

  const list = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_auction", { _user_card_id: group!.free[0]!, _start_price: p, _hours: hours });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${group!.card.name} est en vente !`);
      qc.invalidateQueries({ queryKey: ["auctions"] });
      qc.invalidateQueries({ queryKey: ["my-listed"] });
      onListed();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shown = groups.filter((g) => !q || g.card.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wider">Vendre une carte</DialogTitle>
          <DialogDescription>
            Choisis une carte, un prix de départ et une durée. À la fin, le meilleur enchérisseur gagne la carte et tu reçois le prix moins une taxe de {Math.round(TRANSFER_TAX * 100)} %.
          </DialogDescription>
        </DialogHeader>

        {!group ? (
          <>
            <Input placeholder="Chercher une de tes cartes…" value={q} onChange={(e) => setQ(e.target.value)} />
            {!groups.length ? <p className="text-sm text-muted-foreground">Tu n'as pas encore de carte à vendre. Ouvre des packs !</p> : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {shown.map((g) => {
                  const k = `${g.card.id}:${g.version}`;
                  const none = g.free.length === 0;
                  return (
                    <button key={k} type="button" disabled={none} onClick={() => setPicked(k)} className={cn("relative rounded-lg text-left", none && "opacity-40")} aria-label={`Vendre ${g.card.name}`}>
                      <PlayerCard card={{ ...g.card, version: g.version }} />
                      <span className="mt-1 block text-center text-[11px] text-muted-foreground">
                        ×{g.total}{g.free.length < g.total && ` · ${g.total - g.free.length} en vente`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <form className="flex flex-col gap-4 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (!badPrice) list.mutate(); }}>
            <div className="mx-auto w-44 shrink-0"><PlayerCard card={{ ...group.card, version: group.version }} /></div>
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm">
                Tu as <b>{group.total}</b> exemplaire{group.total > 1 ? "s" : ""} de cette carte.
                {group.total === 1 && " C'est ton dernier : si elle est vendue, elle quittera ta collection."}
              </p>
              <div>
                <label htmlFor="start-price" className="text-sm font-semibold">Prix de départ (pièces)</label>
                <Input id="start-price" type="number" inputMode="numeric" min={MIN_START_PRICE} step={1} value={price} onChange={(e) => setPrice(e.target.value)} />
                {badPrice && <p className="mt-1 text-xs font-bold text-destructive">Minimum {MIN_START_PRICE} pièces.</p>}
              </div>
              <div>
                <span className="text-sm font-semibold">Durée</span>
                <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Durée">
                  {AUCTION_DURATIONS.map((d) => (
                    <button key={d.hours} type="button" role="radio" aria-checked={hours === d.hours} onClick={() => setHours(d.hours)}
                      className={cn("rounded-full px-4 py-1.5 text-sm font-bold", hours === d.hours ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              {!badPrice && (
                <p className="text-xs text-muted-foreground">
                  <Tag className="mr-1 inline h-3 w-3" />Si elle part au prix de départ, tu recevras {sellerPayout(p)} pièces. Tu peux annuler tant que personne n'a enchéri. Sans enchère, la carte reste dans ta collection.
                </p>
              )}
              <div className="mt-auto flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setPicked(null)}>Changer de carte</Button>
                <Button type="submit" disabled={badPrice || list.isPending} className="flex-1 bg-gold text-primary-foreground">
                  <Gavel className="h-4 w-4" /> Mettre aux enchères
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

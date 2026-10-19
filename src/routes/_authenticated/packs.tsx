import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Timer } from "lucide-react";
import packClassic from "@/assets/pack-classic.png";
import packPremium from "@/assets/pack-premium.png";
import { supabase } from "@/integrations/supabase/client";
import { useMyPacks, useProfile } from "@/lib/auth";
import { PackOpening, type OpenResult } from "@/components/PackOpening";

export const Route = createFileRoute("/_authenticated/packs")({
  head: () => ({
    meta: [
      { title: "Mes packs — Goalmaster" },
      { name: "description", content: "Ouvrez vos boosters Classique et Premium." },
      { property: "og:title", content: "Mes packs — Goalmaster" },
      { property: "og:description", content: "Ouvrez vos boosters Goalmaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PacksPage,
});

const IMG: Record<string, string> = { classic: packClassic, premium: packPremium };

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}h ` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function PacksPage() {
  const { data: packs, refetch } = useMyPacks();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [opening, setOpening] = useState<{ key: string; result: OpenResult | null } | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(key: string) {
    if (busy) return;
    setBusy(true);
    setOpening({ key, result: null });
    const { data, error } = await supabase.rpc("open_pack", { _pack_key: key });
    if (error) {
      toast.error(error.message);
      setOpening(null);
      setBusy(false);
      refetch();
      return;
    }
    setOpening({ key, result: data as unknown as OpenResult });
    qc.invalidateQueries({ queryKey: ["packs"] });
  }

  async function buy(key: string) {
    const { error } = await supabase.rpc("buy_pack", { _pack_key: key });
    if (error) { toast.error(error.message); return; }
    toast.success("Pack acheté !");
    qc.invalidateQueries({ queryKey: ["packs"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function close() {
    setOpening(null);
    setBusy(false);
    qc.invalidateQueries();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-5xl text-gold">Mes packs</h1>
      <p className="text-muted-foreground">Les packs se rechargent automatiquement, même quand vous êtes déconnecté.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {packs?.map((p) => (
          <PackTile key={p.pack_key} p={p} coins={profile?.coins ?? 0} onOpen={() => open(p.pack_key)} onBuy={() => buy(p.pack_key)} busy={busy} />
        ))}
      </div>
      {opening && <PackOpening packImage={IMG[opening.key] ?? packClassic} result={opening.result} onClose={close} />}
    </div>
  );
}

function PackTile({
  p,
  coins,
  onOpen,
  onBuy,
  busy,
}: {
  p: { pack_key: string; name: string; description: string; count: number; max_stock: number; next_at: string; price_coins: number };
  coins: number;
  onOpen: () => void;
  onBuy: () => void;
  busy: boolean;
}) {
  const cd = useCountdown(p.next_at);
  return (
    <div className="panel flex flex-col items-center p-6 text-center">
      <button onClick={onOpen} disabled={busy || p.count < 1} className="group disabled:opacity-50">
        <img src={IMG[p.pack_key] ?? packClassic} alt={p.name} width={768} height={1152} className={`w-40 transition group-hover:scale-105 group-enabled:anim-float ${p.pack_key === "premium" ? "drop-shadow-[0_0_22px_var(--card-light)]" : ""}`} />
      </button>
      <h2 className="mt-4 text-3xl">{p.name}</h2>
      <p className="text-sm text-muted-foreground">{p.description}</p>
      <p className="mt-3 font-display text-4xl text-gold">
        {p.count} <span className="text-xl text-muted-foreground">/ {p.max_stock}</span>
      </p>
      {cd && (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" /> Prochain pack dans {cd}
        </p>
      )}
      <button
        onClick={onOpen}
        disabled={busy || p.count < 1}
        className="mt-4 w-full rounded-xl bg-gold py-3 font-display text-xl tracking-widest text-primary-foreground shadow-gold disabled:opacity-40"
      >
        Ouvrir
      </button>
      {p.price_coins > 0 && (
        <button
          onClick={onBuy}
          disabled={coins < p.price_coins}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-primary/50 py-2 text-sm font-bold text-primary disabled:opacity-40"
        >
          Acheter 1 pack · <Coins className="h-4 w-4" /> {p.price_coins}
        </button>
      )}
    </div>
  );
}

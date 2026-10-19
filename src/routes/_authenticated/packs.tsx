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
import { SwipePack } from "@/components/SwipePack";
import { cn } from "@/lib/utils";

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const selected = packs?.find((p) => p.pack_key === selectedKey) ?? packs?.[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-5xl text-gold">Mes packs</h1>
      <p className="text-muted-foreground">Choisis un pack, puis fais-le glisser vers la gauche pour l'ouvrir.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choix du pack">
        {packs?.map((p) => (
          <PackChoice key={p.pack_key} p={p} selected={selected?.pack_key === p.pack_key} onSelect={() => setSelectedKey(p.pack_key)} />
        ))}
      </div>

      {selected && (
        <div className="panel mt-6 flex flex-col items-center p-4 text-center">
          <h2 className="text-3xl">{selected.name}</h2>
          <p className="text-sm text-muted-foreground">{selected.description}</p>
          <SwipePack
            image={IMG[selected.pack_key] ?? packClassic}
            name={selected.name}
            premium={selected.pack_key === "premium"}
            disabled={busy || selected.count < 1}
            onOpen={() => open(selected.pack_key)}
          />
          {selected.price_coins > 0 && (
            <button
              onClick={() => buy(selected.pack_key)}
              disabled={(profile?.coins ?? 0) < selected.price_coins}
              className="mt-2 flex w-full max-w-xs items-center justify-center gap-1 rounded-xl border border-primary/50 py-2 text-sm font-bold text-primary disabled:opacity-40"
            >
              Acheter 1 pack · <Coins className="h-4 w-4" /> {selected.price_coins}
            </button>
          )}
        </div>
      )}
      {opening && <PackOpening packImage={IMG[opening.key] ?? packClassic} result={opening.result} onClose={close} />}
    </div>
  );
}

function PackChoice({
  p,
  selected,
  onSelect,
}: {
  p: { pack_key: string; name: string; count: number; max_stock: number; next_at: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const cd = useCountdown(p.next_at);
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "panel flex items-center gap-4 p-3 text-left transition",
        selected ? "ring-2 ring-primary shadow-gold" : "opacity-70 hover:opacity-100",
      )}
    >
      <img src={IMG[p.pack_key] ?? packClassic} alt="" width={768} height={1152} className="w-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl leading-none">{p.name}</p>
        <p className="mt-1 font-display text-xl text-gold">
          {p.count} <span className="text-sm text-muted-foreground">/ {p.max_stock}</span>
        </p>
        {cd && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" /> Prochain dans {cd}
          </p>
        )}
      </div>
    </button>
  );
}

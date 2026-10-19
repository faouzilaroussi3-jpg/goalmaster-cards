import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayerCard } from "@/components/PlayerCard";
import { rarityMeta, VERSION_LABEL } from "@/lib/rarity";
import { cn } from "@/lib/utils";

interface BigPull {
  id: string; username: string | null; card_id: string; name: string; club: string; nationality: string; pos: string;
  rating: number; rarity: string; version: string; image_url: string | null; pack_key: string | null; pulled_at: string;
}

const PACK_NAME: Record<string, string> = { classic: "Classique", premium: "Premium" };
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function timeAgo(iso: string, now: number) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  if (s > -45) return "à l'instant";
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  if (s > -86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Live strip of the biggest pulls (Légendaire and above), updated in real time. */
export function LivePulls({ limit = 20 }: { limit?: number }) {
  const qc = useQueryClient();
  const { data: pulls = [] } = useQuery({
    queryKey: ["big-pulls", limit],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_big_pulls", { _limit: limit });
      if (error) throw error;
      return (data ?? []) as BigPull[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("big-pulls-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "big_pulls" }, () => {
        qc.invalidateQueries({ queryKey: ["big-pulls"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Only pulls that arrive while the page is open get the entrance animation.
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!pulls.length) return;
    if (known.current === null) { known.current = new Set(pulls.map((p) => p.id)); return; }
    const added = pulls.filter((p) => !known.current!.has(p.id)).map((p) => p.id);
    added.forEach((id) => known.current!.add(id));
    if (added.length) setFresh(new Set(added));
  }, [pulls]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  return (
    <section className="panel mt-6 p-4" aria-label="Gros tirages en direct">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <h2 className="font-display text-2xl tracking-wide">Gros tirages en direct</h2>
        <span className="ml-auto text-xs text-muted-foreground">Légendaire et plus</span>
      </div>
      {!pulls.length ? (
        <p className="text-sm text-muted-foreground">Aucun gros tirage pour l'instant. Le prochain sera peut-être le tien !</p>
      ) : (
        <ol className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1">
          {pulls.map((p) => {
            const meta = rarityMeta(p.rarity);
            const special = p.version !== "normal";
            return (
              <li
                key={p.id}
                className={cn("w-28 shrink-0 snap-start sm:w-32", fresh.has(p.id) && "animate-in zoom-in-50 fade-in duration-700")}
              >
                <PlayerCard card={{ ...p, id: p.card_id, alt_image_url: p.version === "alt" ? p.image_url : null }} />
                <p className="mt-1.5 truncate text-center text-xs font-semibold">{p.username ?? "Un joueur"}</p>
                <p className="truncate text-center text-[10px] text-muted-foreground">
                  {meta.short}{special ? ` ${VERSION_LABEL[p.version] ?? p.version}` : ""}
                  {p.pack_key ? ` · ${PACK_NAME[p.pack_key] ?? p.pack_key}` : ""} · {timeAgo(p.pulled_at, now)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

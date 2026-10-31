import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sfx } from "@/lib/sfx";
import {
  cleanShirtName, clampNumber, DEFAULT_LOOK, HAIR_COLORS, HAIR_STYLES, lookError, lookFromRow, SHOE_COLORS, SHOE_STYLES, SKIN_TONES,
  type AvatarLook, type AvatarRow,
} from "@/lib/avatar";
import { kitFor, type Kit } from "@/lib/kits";
import { sideTrophiesOf, trophiesOf } from "@/lib/ballon-dor";
import { useCeremonies, useCeremonyAwards } from "@/lib/ballon-dor-query";

const AvatarStage = lazy(() => import("@/components/avatar/AvatarStage"));

export const Route = createFileRoute("/_authenticated/avatar")({
  head: () => ({
    meta: [
      { title: "Mon avatar 3D — Goalmaster" },
      { name: "description", content: "Crée ton avatar 3D et habille-le avec les maillots des clubs que tu as tirés dans les packs." },
      { property: "og:title", content: "Mon avatar 3D — Goalmaster" },
      { property: "og:description", content: "Avatar 3D, maillots de tes clubs et vitrine de Ballons d'Or." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AvatarPage,
});

function KitSwatch({ kit, className = "h-7 w-7" }: { kit: Kit; className?: string }) {
  const bg = kit.pattern === "stripes" ? `repeating-linear-gradient(90deg, ${kit.shirt} 0 5px, ${kit.alt} 5px 10px)`
    : kit.pattern === "hoops" ? `repeating-linear-gradient(0deg, ${kit.shirt} 0 5px, ${kit.alt} 5px 10px)`
    : kit.pattern === "halves" ? `linear-gradient(90deg, ${kit.shirt} 50%, ${kit.alt} 50%)`
    : kit.pattern === "sash" ? `linear-gradient(135deg, ${kit.shirt} 38%, ${kit.alt} 38% 62%, ${kit.shirt} 62%)`
    : kit.pattern === "band" ? `linear-gradient(90deg, ${kit.shirt} 35%, ${kit.alt} 35% 65%, ${kit.shirt} 65%)`
    : kit.shirt;
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-md border border-border ${className}`} aria-hidden>
      <span className="absolute inset-x-0 top-0 h-2/3" style={{ background: bg }} />
      <span className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: kit.shorts }} />
    </span>
  );
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onPick(c)}
          className={`h-7 w-7 rounded-full border-2 transition ${value === c ? "scale-110 border-primary" : "border-border"}`} style={{ background: c }} />
      ))}
    </div>
  );
}

function Chips<T extends string>({ items, value, onPick, label }: { items: readonly { id: T; label: string }[]; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="radio" aria-checked={value === it.id} onClick={() => onPick(it.id)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${value === it.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

function AvatarPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const { data: row, isLoading } = useQuery({
    queryKey: ["avatar", uid],
    queryFn: async () => (await supabase.from("avatars").select("*").eq("user_id", uid).maybeSingle()).data as AvatarRow | null,
  });
  const { data: clubs = [] } = useQuery({
    queryKey: ["kit-clubs", uid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_kit_clubs");
      if (error) throw error;
      return (data ?? []) as { club: string; pulls: number }[];
    },
  });
  const { data: ceremonies = [] } = useCeremonies();
  const trophies = trophiesOf(ceremonies, uid).length;
  const { data: awards = [] } = useCeremonyAwards();
  const others = useMemo(() => sideTrophiesOf(awards, uid).map((a) => a.kind), [awards, uid]);
  const [look, setLook] = useState<AvatarLook>(DEFAULT_LOOK);
  const [back, setBack] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!isLoading) setLook(lookFromRow(row)); }, [row, isLoading]);
  const saved = lookFromRow(row);
  const dirty = JSON.stringify(saved) !== JSON.stringify(look);
  const unlocked = useMemo(() => clubs.map((c) => c.club), [clubs]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return clubs.filter((c) => !n || c.club.toLowerCase().includes(n)).slice(0, 80);
  }, [clubs, q]);

  const set = (patch: Partial<AvatarLook>) => { sfx.outfit(); setLook((l) => ({ ...l, ...patch })); };

  async function save() {
    const err = lookError(look, unlocked);
    if (err) { toast.error(err); return; }
    setSaving(true);
    const { error } = await supabase.rpc("save_avatar", {
      _skin: look.skin, _hair: look.hair, _hair_color: look.hairColor, _shoes: look.shoes, _shoe_color: look.shoeColor,
      _kit_club: look.club as string, _shirt_name: look.shirtName, _shirt_number: look.number,
    });
    setSaving(false);
    if (error) { sfx.error(); toast.error(error.message); return; }
    sfx.success();
    toast.success("Avatar enregistré !");
    qc.invalidateQueries({ queryKey: ["avatar", uid] });
    qc.invalidateQueries({ queryKey: ["avatars"] });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl text-gold">Mon avatar</h1>
          <p className="text-sm text-muted-foreground">Habille-le avec les maillots des clubs que tu as tirés dans les packs.</p>
        </div>
        <Link to="/ballon-dor" className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground">
          <Trophy className="h-4 w-4 text-primary" /> Ballon d'Or
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="panel relative h-[58vh] min-h-[380px] overflow-hidden p-0">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Chargement du vestiaire…</div>}>
            <AvatarStage look={look} trophies={trophies} others={others} back={back} />
          </Suspense>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            <button type="button" onClick={() => setBack(false)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${!back ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"}`}>Face</button>
            <button type="button" onClick={() => setBack(true)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${back ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"}`}>Dos</button>
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground">
            Vitrine : {trophies} Ballon{trophies > 1 ? "s" : ""} d'Or{others.length ? ` · ${others.length} autre${others.length > 1 ? "s" : ""} trophée${others.length > 1 ? "s" : ""}` : ""}
          </div>
        </div>

        <div className="panel space-y-5 p-4">
          <section>
            <h2 className="mb-2 text-xl">Maillot & short</h2>
            <button type="button" onClick={() => set({ club: null })}
              className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm ${look.club === null ? "border-primary bg-primary/10" : "border-border"}`}>
              <KitSwatch kit={kitFor(null)} /> <span className="font-bold">Goalmaster</span> <span className="ml-auto text-xs text-muted-foreground">offert</span>
            </button>
            {clubs.length > 8 && (
              <label className="mb-2 flex items-center gap-2 rounded-lg border border-input bg-background/60 px-2 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher parmi tes ${clubs.length} clubs`} className="w-full bg-transparent text-sm text-foreground outline-none" />
              </label>
            )}
            <div className="grid max-h-56 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
              {shown.map((c) => (
                <button key={c.club} type="button" onClick={() => set({ club: c.club })}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm ${look.club === c.club ? "border-primary bg-primary/10" : "border-border"}`}>
                  <KitSwatch kit={kitFor(c.club)} />
                  <span className="truncate">{c.club}</span>
                </button>
              ))}
            </div>
            {!clubs.length && <p className="text-xs text-muted-foreground">Ouvre des packs : chaque club tiré débloque son maillot.</p>}
            {clubs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{clubs.length} maillot{clubs.length > 1 ? "s" : ""} débloqué{clubs.length > 1 ? "s" : ""} grâce à tes packs.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-[1fr_96px]">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase text-muted-foreground">Nom au dos</span>
              <input value={look.shirtName} maxLength={12} onChange={(e) => setLook((l) => ({ ...l, shirtName: cleanShirtName(e.target.value) }))}
                placeholder="MBAPPÉ" className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-display text-lg tracking-widest text-foreground" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase text-muted-foreground">Numéro</span>
              <input type="number" min={1} max={99} value={look.number} onChange={(e) => setLook((l) => ({ ...l, number: clampNumber(Number(e.target.value)) }))}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-display text-lg text-foreground" />
            </label>
          </section>

          <section>
            <h2 className="mb-2 text-xl">Couleur de peau</h2>
            <Swatches colors={SKIN_TONES} value={look.skin} onPick={(c) => set({ skin: c })} label="Couleur de peau" />
          </section>
          <section className="space-y-2">
            <h2 className="text-xl">Coiffure</h2>
            <Chips items={HAIR_STYLES} value={look.hair} onPick={(v) => set({ hair: v })} label="Coiffure" />
            <Swatches colors={HAIR_COLORS} value={look.hairColor} onPick={(c) => set({ hairColor: c })} label="Couleur des cheveux" />
          </section>
          <section className="space-y-2">
            <h2 className="text-xl">Chaussures</h2>
            <Chips items={SHOE_STYLES} value={look.shoes} onPick={(v) => set({ shoes: v })} label="Chaussures" />
            <Swatches colors={SHOE_COLORS} value={look.shoeColor} onPick={(c) => set({ shoeColor: c })} label="Couleur des chaussures" />
          </section>

          <button type="button" data-sfx="none" onClick={save} disabled={saving || !dirty}
            className="w-full rounded-lg bg-gold py-3 font-bold text-primary-foreground disabled:opacity-50">
            {saving ? "Enregistrement…" : dirty ? "Enregistrer mon avatar" : "Avatar enregistré"}
          </button>
        </div>
      </div>
    </div>
  );
}

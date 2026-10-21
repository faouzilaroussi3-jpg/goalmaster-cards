import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Gamepad2, Sparkles, Swords, Trophy, Gavel, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { GAME_MODES, isSplashBlocked, newsSplash, shouldOpenSplash, SLIDE_MS, SPLASH_SESSION_KEY, unseenNews, type Announcement } from "@/lib/news";
import { useNews, useStarCards } from "@/lib/news-query";
import { rarityMeta, type CardData } from "@/lib/rarity";
import { packLookOf } from "@/lib/pack-look";
import { PackFx, packImageOf, packImgStyle } from "@/components/PackArt";
import { PlayerCard } from "@/components/PlayerCard";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "card" | "rarity" | "pack"; a: Announcement; fresh: boolean }
  | { kind: "modes" }
  | { kind: "stars" };

const MODE_ICON = { live: Gamepad2, manager: Users, duels: Swords, transferts: Gavel, defis: Trophy } as const;

/** Welcome screen in the style of a game ad: latest packs / cards / rarities, the game modes and star cards. */
export function NewsSplash() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const open = useSyncExternalStore(newsSplash.subscribe, newsSplash.get, () => false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: news } = useNews();
  const { data: starRows = [] } = useStarCards();
  const autoOpened = useRef(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const unseen = useMemo(() => (news ? unseenNews(news.list, news.seenAt) : []), [news]);

  // Auto-open once per visit, or when news arrived since last time.
  useEffect(() => {
    if (!session || !news || autoOpened.current) return;
    const shown = sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
    if (!shouldOpenSplash({ unseen: unseen.length, shownThisVisit: shown, blockedRoute: isSplashBlocked(pathname) })) return;
    autoOpened.current = true;
    newsSplash.set(true);
  }, [session, news, unseen.length, pathname]);

  const stars = useMemo(() => {
    const seen = new Set<string>();
    return starRows.filter((c) => rarityMeta(c.rarity).play !== "secret_ultimate" && !seen.has(c.name) && seen.add(c.name)).slice(0, 5);
  }, [starRows]);

  const slides = useMemo<Slide[]>(() => {
    const fresh = new Set(unseen.map((a) => a.id));
    const list = (unseen.length ? unseen : (news?.list ?? []).slice(0, 3)).slice(0, 5);
    return [
      ...list.map((a) => ({ kind: a.kind, a, fresh: fresh.has(a.id) }) as Slide),
      { kind: "modes" } as Slide,
      ...(stars.length ? [{ kind: "stars" } as Slide] : []),
    ];
  }, [unseen, news, stars.length]);

  useEffect(() => { if (open) { setI(0); sfx.sparkle(); } }, [open]);

  // Auto-advance like a story; stops on the last slide.
  useEffect(() => {
    if (!open || paused || i >= slides.length - 1) return;
    const t = setTimeout(() => setI((v) => v + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, paused, i, slides.length]);

  const close = () => {
    newsSplash.set(false);
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    if (session) supabase.rpc("mark_news_seen").then(() => qc.invalidateQueries({ queryKey: ["news"] }));
  };
  const go = (d: number) => { sfx.select(); setI((v) => Math.max(0, Math.min(slides.length - 1, v + d))); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open || !session) return null;
  const slide = slides[Math.min(i, slides.length - 1)]!;
  const last = i >= slides.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Nouveautés Goalmaster"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="news-splash relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-primary/40"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {/* Story progress */}
        <div className="flex gap-1 px-4 pt-3">
          {slides.map((_, k) => (
            <button key={k} type="button" data-sfx="none" aria-label={`Diapositive ${k + 1}`} onClick={() => { sfx.select(); setI(k); }} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/20">
              <span className={cn("block h-full bg-primary", k < i && "w-full", k > i && "w-0", k === i && (paused || last ? "w-full" : "news-progress"))} style={k === i ? { animationDuration: `${SLIDE_MS}ms` } : undefined} />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 pt-2">
          <span className="font-display text-base tracking-[0.2em] text-primary sm:text-xl sm:tracking-[0.3em]">GOALMASTER · NOUVEAUTÉS</span>
          <button type="button" onClick={close} aria-label="Fermer" className="rounded-full p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div key={i} className="news-slide grid min-h-0 flex-1 items-center gap-4 overflow-y-auto px-5 pb-4 pt-2 sm:grid-cols-[1fr_1.1fr] sm:px-8">
          <SlideBody slide={slide} stars={stars} onGo={close} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-background/40 px-4 py-2.5">
          <button type="button" data-sfx="none" onClick={() => go(-1)} disabled={i === 0} className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Précédent"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-xs text-muted-foreground">{i + 1} / {slides.length}</span>
          {last ? (
            <button type="button" onClick={close} className="rounded-full bg-primary px-5 py-1.5 font-display text-lg tracking-wide text-primary-foreground shadow-gold">C'est parti !</button>
          ) : (
            <button type="button" data-sfx="none" onClick={() => go(1)} className="rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Suivant"><ChevronRight className="h-5 w-5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

function Ribbon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-primary-foreground"><Sparkles className="h-3.5 w-3.5" />{children}</span>;
}

function Cta({ to, label, onGo }: { to: string; label: string; onGo: () => void }) {
  return (
    <Link to={to} onClick={onGo} className="mt-4 inline-flex rounded-full bg-gold px-6 py-2 font-display text-xl tracking-wide text-primary-foreground shadow-gold transition hover:scale-105">
      {label}
    </Link>
  );
}

function CardFan({ cards }: { cards: CardData[] }) {
  const n = cards.length;
  return (
    <div className="relative mx-auto flex h-56 w-full max-w-md items-center justify-center sm:h-72">
      {cards.map((c, k) => {
        const off = k - (n - 1) / 2;
        return (
          <div key={`${c.id}-${k}`} className="news-float absolute w-24 sm:w-32" style={{ transform: `translateX(${off * 58}%) rotate(${off * 7}deg) translateY(${Math.abs(off) * 8}%)`, zIndex: 10 - Math.abs(Math.round(off)), animationDelay: `${k * 0.3}s` }}>
            <PlayerCard card={c} />
          </div>
        );
      })}
    </div>
  );
}

function SlideBody({ slide, stars, onGo }: { slide: Slide; stars: CardData[]; onGo: () => void }) {
  if (slide.kind === "modes") {
    return (
      <>
        <div>
          <Ribbon>Modes de jeu</Ribbon>
          <h2 className="mt-3 font-display text-5xl leading-none text-gold sm:text-6xl">Joue comme tu veux</h2>
          <p className="mt-2 text-sm text-muted-foreground">Collectionne, compose ton équipe et affronte les autres joueurs.</p>
        </div>
        <ul className="grid gap-2">
          {GAME_MODES.map((m) => {
            const Icon = MODE_ICON[m.key];
            return (
              <li key={m.key}>
                <Link to={m.to} onClick={onGo} className="flex items-start gap-3 rounded-xl border border-border bg-card/70 p-3 transition hover:border-primary">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-display text-xl leading-none">{m.title}{m.isNew && <span className="rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">NOUVEAU</span>}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{m.text}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  }
  if (slide.kind === "stars") {
    return (
      <>
        <div>
          <Ribbon>Les stars</Ribbon>
          <h2 className="mt-3 font-display text-5xl leading-none text-gold sm:text-6xl">Les meilleures cartes t'attendent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ouvre des packs pour tenter de les ajouter à ta collection.</p>
          <Cta to="/packs" label="Ouvrir des packs" onGo={onGo} />
        </div>
        <CardFan cards={stars} />
      </>
    );
  }
  const { a, fresh } = slide;
  if (slide.kind === "card") {
    const cards = (a.items as CardData[]).slice(0, 5);
    return (
      <>
        <div>
          <Ribbon>{fresh ? "Nouveau" : "Récemment"}</Ribbon>
          <h2 className="mt-3 font-display text-5xl leading-none text-gold sm:text-6xl">{a.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
          <Cta to="/packs" label="Ouvrir des packs" onGo={onGo} />
        </div>
        <CardFan cards={cards} />
      </>
    );
  }
  if (slide.kind === "rarity") {
    const r = (a.items[0] ?? {}) as { key?: string; label?: string };
    const sample = stars[0];
    const meta = rarityMeta(r.key ?? "");
    return (
      <>
        <div>
          <Ribbon>{fresh ? "Nouvelle rareté" : "Rareté"}</Ribbon>
          <h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl" style={{ color: meta.color ?? "var(--primary)" }}>{r.label ?? a.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
          <Cta to="/packs" label="Tenter ma chance" onGo={onGo} />
        </div>
        {sample && r.key && (
          <div className="news-float mx-auto w-36 sm:w-48"><PlayerCard card={{ ...sample, rarity: r.key, version: "normal" }} /></div>
        )}
      </>
    );
  }
  const p = (a.items[0] ?? {}) as { key?: string; name?: string; art?: string; tint?: string | null; effect?: string; image_url?: string | null; price_coins?: number };
  const look = packLookOf(p);
  return (
    <>
      <div>
        <Ribbon>{fresh ? "Nouveau pack" : "Pack"}</Ribbon>
        <h2 className="mt-3 font-display text-5xl leading-none text-gold sm:text-6xl">{p.name ?? a.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
        {!!p.price_coins && <p className="mt-2 font-display text-2xl text-primary">{p.price_coins} pièces</p>}
        <Cta to="/packs" label="Voir le pack" onGo={onGo} />
      </div>
      <PackFx look={look} className="news-float mx-auto w-32 sm:w-44">
        <img src={packImageOf(look)} alt={p.name ?? "Pack"} className="relative w-full" style={packImgStyle(look)} />
      </PackFx>
    </>
  );
}

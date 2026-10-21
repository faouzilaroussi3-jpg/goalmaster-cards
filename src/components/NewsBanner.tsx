import { useEffect, useState } from "react";
import { newsSplash, SLIDE_MS } from "@/lib/news";
import { SlideBody, useNewsSlides } from "@/components/NewsSplash";
import { cn } from "@/lib/utils";

/** The welcome screen as a banner on the Packs page: news, modes and star cards loop forever. */
export function NewsBanner() {
  const { slides, stars } = useNewsSlides();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, paused, n]);

  if (!n) return null;
  const k = i % n;
  return (
    <section aria-label="Nouveautés" className="news-splash relative mt-6 overflow-hidden rounded-2xl border border-primary/40"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex gap-1 px-4 pt-3">
        {slides.map((_, j) => (
          <button key={j} type="button" data-sfx="none" aria-label={`Diapositive ${j + 1}`} onClick={() => setI(j)} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/20">
            <span className={cn("block h-full bg-primary", j < k && "w-full", j > k && "w-0", j === k && (paused ? "w-full" : "news-progress"))} style={j === k ? { animationDuration: `${SLIDE_MS}ms` } : undefined} />
          </button>
        ))}
      </div>
      <div key={k} className="news-slide grid items-center gap-4 px-5 pb-5 pt-3 sm:grid-cols-[1fr_1.1fr] sm:px-8">
        <SlideBody slide={slides[k]!} stars={stars} onGo={() => newsSplash.set(false)} />
      </div>
    </section>
  );
}

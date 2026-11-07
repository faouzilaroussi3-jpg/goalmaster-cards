import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Clock, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { QUIZ_SECONDS, quizSecondsLeft, type QuizQuestion } from "@/lib/quiz";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({
    meta: [
      { title: "Quiz foot — Goalmaster" },
      { name: "description", content: "Une minute de quiz foot : questions classiques, joueurs à reconnaître et photos à choisir. Des milliers de questions et un classement Goalmaster." },
      { property: "og:title", content: "Quiz foot — Goalmaster" },
      { property: "og:description", content: "60 secondes, des questions foot et des photos de joueurs : grimpe au classement du Quiz Goalmaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizPage,
});

const BUILTIN_COLOR: Record<string, string> = {
  common: "var(--r-common)", uncommon: "var(--r-uncommon)", rare: "var(--r-rare)", super_rare: "var(--r-sr)",
  legendary: "var(--r-legendary)", secret_legendary: "var(--r-sl)",
};
const colorOf = (q: QuizQuestion) => q.color ?? BUILTIN_COLOR[q.rarity] ?? "var(--primary)";

interface Result { score: number; correct: number; answered: number; best: number }
interface Board { user_id: string; username: string; best: number; total: number; runs: number }

function QuizPage() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [run, setRun] = useState<{ id: string; endsAt: string; offset: number } | null>(null);
  const [q, setQ] = useState<QuizQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(QUIZ_SECONDS);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ choice: string; answer: string; ok: boolean } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const finishing = useRef(false);
  const nextQuestion = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (nextQuestion.current) clearTimeout(nextQuestion.current);
  }, []);

  const board = useQuery({
    queryKey: ["quiz-board", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quiz_leaderboard", { _period: period });
      if (error) throw error;
      return (data ?? []) as Board[];
    },
  });

  const end = async (runId: string, r?: Result) => {
    if (finishing.current) return;
    finishing.current = true;
    if (nextQuestion.current) clearTimeout(nextQuestion.current);
    let res = r;
    if (!res) {
      const { data } = await supabase.rpc("finish_quiz", { _run: runId });
      res = data as unknown as Result;
    }
    setRun(null); setQ(null); setResult(res ?? { score, correct, answered: 0, best: score });
    sfx.success();
    qc.invalidateQueries({ queryKey: ["quiz-board"] });
  };

  useEffect(() => {
    if (!run) return undefined;
    const t = setInterval(() => {
      const s = quizSecondsLeft(run.endsAt, run.offset);
      setLeft(s);
      if (s <= 0) end(run.id);
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("start_quiz");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const d = data as unknown as { run_id: string; ends_at: string; server_now: string; question: QuizQuestion };
    finishing.current = false;
    setResult(null); setScore(0); setCorrect(0); setFlash(null); setLeft(QUIZ_SECONDS);
    setRun({ id: d.run_id, endsAt: d.ends_at, offset: new Date(d.server_now).getTime() - Date.now() });
    setQ(d.question);
    sfx.whoosh();
  };

  const answer = async (choice: string) => {
    if (!run || !q || busy || flash || finishing.current) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("answer_quiz", { _run: run.id, _choice: choice });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const d = data as unknown as Result & { finished: boolean; was_correct?: boolean; answer?: string; question?: QuizQuestion };
    if (d.answer !== undefined) {
      setFlash({ choice, answer: d.answer, ok: !!d.was_correct });
      if (d.was_correct) sfx.coins(); else sfx.error();
    }
    setScore(d.score); setCorrect(d.correct);
    if (d.finished) { void end(run.id, d); return; }
    nextQuestion.current = setTimeout(() => {
      if (finishing.current) return;
      setFlash(null); setQ(d.question ?? null);
    }, 350);
  };

  const pct = (left / QUIZ_SECONDS) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-4xl tracking-wide"><Brain className="h-8 w-8 text-primary" /> Quiz foot</h1>
        <p className="text-sm text-muted-foreground">
          {QUIZ_SECONDS} secondes pour répondre au plus de questions possible. Chaque question a une rareté tirée comme dans un pack :
          une Commune est difficile (10 pts), plus elle est rare plus elle est facile (moins de choix) — mais elle tombe beaucoup moins souvent.
        </p>
      </header>

      {run && q ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 font-bold"><Clock className="h-4 w-4" /> {left}s</span>
            <span>Question {q.number}</span>
            <span className="flex items-center gap-1 font-bold text-primary"><Zap className="h-4 w-4" /> {score} pts · {correct} ✓</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="rounded-lg border-2 p-4" style={{ borderColor: colorOf(q) }}>
            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider" style={{ color: colorOf(q) }}>
              <span>{q.label}</span><span>+{q.points} pts</span>
            </div>
            <p className="text-lg font-semibold">{q.prompt}</p>
            {q.format === "photo_words" && q.image_url && (
              <figure className="mx-auto mt-3 w-40 sm:w-48">
                <QuizPhoto key={q.image_url} src={q.image_url} />
                <figcaption className="mt-2 flex min-h-10 items-center justify-center rounded-md border border-border bg-muted px-2 text-center font-semibold">
                  {flash?.choice ?? "?"}
                </figcaption>
              </figure>
            )}
          </div>
          <div className={cn("grid gap-2", q.format === "image_choice" ? "grid-cols-2" : "sm:grid-cols-2")}>
            {q.options.map((o, i) => {
              const state = flash ? (o === flash.answer ? "good" : o === flash.choice ? "bad" : "idle") : "idle";
              const photo = q.image_options?.find((item) => item.value === o);
              return (
                <Button key={o} variant="outline" disabled={busy || !!flash} onClick={() => answer(o)} data-sfx="none"
                  aria-label={photo ? `Photo ${i + 1}` : o}
                  className={cn("h-auto min-h-12 whitespace-normal text-base", photo ? "block overflow-hidden p-1" : "py-3",
                    state === "good" && "border-primary bg-primary text-primary-foreground",
                    state === "bad" && "border-destructive bg-destructive text-destructive-foreground")}>
                  {photo ? <QuizPhoto src={photo.image_url} /> : o}
                </Button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border border-border bg-card p-6 text-center">
          {result && (
            <div className="space-y-1">
              <p className="font-display text-5xl text-primary">{result.score} pts</p>
              <p className="text-sm text-muted-foreground">{result.correct} bonnes réponses sur {result.answered} · Record : {result.best} pts</p>
            </div>
          )}
          <Button size="lg" onClick={start} disabled={busy}>{result ? "Rejouer" : "Lancer une partie"}</Button>
          <p className="text-xs text-muted-foreground">Tes points comptent pour le classement et pour le Ballon d'Or.</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-2xl"><Trophy className="h-5 w-5 text-primary" /> Classement</h2>
          <div className="flex gap-1">
            {(["week", "all"] as const).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
                {p === "week" ? "Semaine" : "Tout"}
              </Button>
            ))}
          </div>
        </div>
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {(board.data ?? []).map((r, i) => (
            <li key={r.user_id} className={cn("flex items-center gap-3 px-4 py-2 text-sm", r.user_id === uid && "bg-primary/10")}>
              <span className="w-6 font-bold text-primary">{i + 1}</span>
              <span className="flex-1 truncate font-semibold">{r.username}</span>
              <span className="text-xs text-muted-foreground">{r.total} pts au total · {r.runs} parties</span>
              <span className="w-16 text-right font-bold">{r.best} pts</span>
            </li>
          ))}
          {board.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Personne n'a encore joué{period === "week" ? " cette semaine" : ""}.</li>}
        </ol>
      </section>
    </div>
  );
}

function QuizPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
      {failed ? (
        <span className="flex h-full items-center justify-center text-xs text-muted-foreground">Photo indisponible</span>
      ) : (
        <img src={src} alt="" draggable={false} onError={() => setFailed(true)}
          className="h-full w-full object-contain" />
      )}
    </div>
  );
}

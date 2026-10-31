import { Link } from "@tanstack/react-router";
import { Gem, Swords } from "lucide-react";
import { TROPHY_LABEL } from "@/lib/ballon-dor";
import { useCeremonies, useCeremonyAwards, useTrophyLeaders } from "@/lib/ballon-dor-query";

const VERSION = { alt: " ALT", shiny: " Shiny" } as Record<string, string>;
const day = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Admin tab: who would win each side trophy right now (last 7 days), and every side trophy already handed out. */
export function TrophiesAdmin() {
  const { data: leaders, isLoading, error } = useTrophyLeaders();
  const { data: awards = [] } = useCeremonyAwards();
  const { data: ceremonies = [] } = useCeremonies();
  const titleOf = (id: string) => ceremonies.find((c) => c.id === id)?.title ?? "Cérémonie";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ces deux trophées sont remis pendant la cérémonie, juste avant le Ballon d'Or, depuis le pupitre de la page{" "}
        <Link to="/ballon-dor" className="text-primary underline">Ballon d'Or</Link>. Ils comptent les 7 derniers jours avant la remise. Les comptes admin ne sont pas classés.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Calcul en cours…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {leaders && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel p-4">
            <h2 className="flex items-center gap-2 text-2xl"><Gem className="h-5 w-5 text-primary" /> {TROPHY_LABEL.rarest_card}</h2>
            <p className="text-xs text-muted-foreground">Carte tirée dans un pack. Départage : rareté, puis ALT/Shiny, puis note, puis le premier à l'avoir tirée.</p>
            {leaders.rarest[0] ? (
              <div className="mt-3 rounded-lg border border-primary/60 bg-primary/5 p-3">
                <div className="text-xs uppercase text-muted-foreground">Gagnant si remis maintenant</div>
                <div className="font-display text-4xl text-gold">{leaders.rarest[0].username}</div>
                <div className="text-sm font-bold">{leaders.rarest[0].card_name} · {leaders.rarest[0].rarity_label}{VERSION[leaders.rarest[0].version] ?? ""} · {leaders.rarest[0].rating}</div>
                <div className="text-xs text-muted-foreground">Tirée le {day(leaders.rarest[0].pulled_at)}</div>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Aucune carte tirée cette semaine.</p>}
            <ol className="mt-3 space-y-1">
              {leaders.rarest.slice(1).map((r, i) => (
                <li key={r.user_id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate"><span className="text-muted-foreground">{i + 2}.</span> <b>{r.username}</b></span>
                  <span className="truncate text-muted-foreground">{r.card_name} · {r.rarity_label}{VERSION[r.version] ?? ""}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel p-4">
            <h2 className="flex items-center gap-2 text-2xl"><Swords className="h-5 w-5 text-primary" /> {TROPHY_LABEL.most_wins}</h2>
            <p className="text-xs text-muted-foreground">Matchs 11 contre 11 et matchs joués à la main, contre un joueur ou l'ordi. Départage : différence de buts.</p>
            {leaders.wins[0] ? (
              <div className="mt-3 rounded-lg border border-primary/60 bg-primary/5 p-3">
                <div className="text-xs uppercase text-muted-foreground">Gagnant si remis maintenant</div>
                <div className="font-display text-4xl text-gold">{leaders.wins[0].username}</div>
                <div className="text-sm font-bold">{leaders.wins[0].wins} victoire{leaders.wins[0].wins > 1 ? "s" : ""} sur {leaders.wins[0].played} match{leaders.wins[0].played > 1 ? "s" : ""}</div>
                <div className="text-xs text-muted-foreground">Différence de buts : {leaders.wins[0].goal_diff > 0 ? "+" : ""}{leaders.wins[0].goal_diff}</div>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Aucun match gagné cette semaine.</p>}
            <ol className="mt-3 space-y-1">
              {leaders.wins.slice(1).map((w, i) => (
                <li key={w.user_id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate"><span className="text-muted-foreground">{i + 2}.</span> <b>{w.username}</b></span>
                  <span className="text-muted-foreground">{w.wins} victoire{w.wins > 1 ? "s" : ""} / {w.played}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {leaders && <p className="text-xs text-muted-foreground">Période : du {day(leaders.since)} au {day(leaders.until)}.</p>}

      <h2 className="pt-2 text-2xl">Trophées déjà remis</h2>
      <div className="space-y-2">
        {awards.map((a) => (
          <div key={a.id} className="panel flex flex-wrap items-center gap-3 p-3 text-sm">
            {a.kind === "rarest_card" ? <Gem className="h-5 w-5 text-primary" /> : <Swords className="h-5 w-5 text-primary" />}
            <div className="min-w-0 flex-1">
              <div><b>{a.winner_name}</b> · {TROPHY_LABEL[a.kind]}</div>
              <div className="text-xs text-muted-foreground">{a.detail} · +{a.reward_coins} pièces · {titleOf(a.ceremony_id)} · {day(a.awarded_at)}</div>
            </div>
          </div>
        ))}
        {!awards.length && <p className="text-sm text-muted-foreground">Aucun trophée remis pour l'instant.</p>}
      </div>
    </div>
  );
}

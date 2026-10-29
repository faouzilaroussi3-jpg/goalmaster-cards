import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Loader2, Search, Shield, Swords, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRarities } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { duelRecord, matchRecord, rankBoard, winRate, type Board, type PlayerStats } from "@/lib/admin-stats";

const inp = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground";
const fmt = (n: number) => Number(n).toLocaleString("fr-FR");

type SortKey = "username" | "level" | "coins" | "packs_opened" | "rare_pulled" | "cards_owned" | "duel_wins" | "match_wins";

export function StatsAdmin() {
  const rarities = useRarities();
  const [minKey, setMinKey] = useState("rare");
  const [withAdmins, setWithAdmins] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("rare_pulled");
  const [open, setOpen] = useState<string | null>(null);

  const min = rarities.find((r) => r.key === minKey) ?? rarities.find((r) => r.key === "rare");
  const minRank = min?.rank ?? 3;

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-player-stats", minRank],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_player_stats", { _min_rank: minRank });
      if (error) throw error;
      return (data ?? []) as unknown as PlayerStats[];
    },
  });

  const ranked = withAdmins ? rows : rows.filter((r) => !r.is_admin);
  const totals = useMemo(() => ({
    players: rows.length,
    packs: rows.reduce((a, r) => a + Number(r.packs_opened), 0),
    duels: rows.reduce((a, r) => a + duelRecord(r).played, 0) / 2,
  }), [rows]);

  const table = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter((r) => !t || r.username.toLowerCase().includes(t));
    const val = (r: PlayerStats) => (sort === "match_wins" ? matchRecord(r).wins : sort === "username" ? 0 : Number(r[sort]));
    return [...list].sort((a, b) => sort === "username" ? a.username.localeCompare(b.username, "fr") : val(b) - val(a) || a.username.localeCompare(b.username, "fr"));
  }, [rows, q, sort]);

  if (error) return <p className="panel p-4 text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-end gap-4 p-4">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Une carte rare, c'est à partir de
          <select className={inp} value={min?.key ?? "rare"} onChange={(e) => setMinKey(e.target.value)}>
            {rarities.map((r) => <option key={r.key} value={r.key}>{r.label} et plus</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={withAdmins} onChange={(e) => setWithAdmins(e.target.checked)} />
          Inclure les comptes admin dans les classements
        </label>
        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          <Pill label="Joueurs" value={totals.players} />
          <Pill label="Packs ouverts" value={totals.packs} />
          <Pill label="Duels joués" value={Math.round(totals.duels)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <BoardCard board="rare" rows={ranked} icon={<Gem className="h-5 w-5" />} title="Plus de cartes rares"
              hint={`Cartes ${min?.label ?? "Rare"} et plus tirées dans les packs`} unit={["carte", "cartes"]} />
            <BoardCard board="duels" rows={ranked} icon={<Swords className="h-5 w-5" />} title="Plus de duels gagnés"
              hint="Victoires en duel" unit={["victoire", "victoires"]} />
            <BoardCard board="matches" rows={ranked} icon={<Trophy className="h-5 w-5" />} title="Plus de matchs gagnés"
              hint="Matchs 11 contre 11 et matchs joués à la main" unit={["victoire", "victoires"]} />
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl text-gold">Tous les joueurs</h2>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input className={cn(inp, "pl-8")} placeholder="Chercher un joueur" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th k="username" sort={sort} setSort={setSort}>Joueur</Th>
                    <Th k="level" sort={sort} setSort={setSort}>Niveau</Th>
                    <Th k="coins" sort={sort} setSort={setSort}>Pièces</Th>
                    <Th k="packs_opened" sort={sort} setSort={setSort}>Packs</Th>
                    <Th k="rare_pulled" sort={sort} setSort={setSort}>Rares tirées</Th>
                    <Th k="cards_owned" sort={sort} setSort={setSort}>Cartes</Th>
                    <Th k="duel_wins" sort={sort} setSort={setSort}>Duels V-N-D</Th>
                    <Th k="match_wins" sort={sort} setSort={setSort}>Matchs V-N-D</Th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => {
                    const d = duelRecord(r), m = matchRecord(r);
                    const isOpen = open === r.user_id;
                    return (
                      <FragmentRow key={r.user_id} open={isOpen} onToggle={() => setOpen(isOpen ? null : r.user_id)} detail={<Detail r={r} minLabel={min?.label ?? "Rare"} />}>
                        <td className="py-2 font-bold text-foreground">
                          {r.username}
                          {r.is_admin && <Shield className="ml-1 inline h-3.5 w-3.5 text-primary" aria-label="Admin" />}
                        </td>
                        <td>{r.level}</td>
                        <td>{fmt(r.coins)}</td>
                        <td>{fmt(r.packs_opened)}</td>
                        <td className="font-bold text-primary">{fmt(r.rare_pulled)}</td>
                        <td>{fmt(r.cards_owned)}</td>
                        <td>{d.wins}-{d.draws}-{d.losses}</td>
                        <td>{m.wins}-{m.draws}-{m.losses}</td>
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
              {!table.length && <p className="py-6 text-center text-sm text-muted-foreground">Aucun joueur trouvé.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1">
      <span className="text-muted-foreground">{label} </span><b className="text-foreground">{fmt(value)}</b>
    </span>
  );
}

function Th({ k, sort, setSort, children }: { k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <th className="py-2 pr-2">
      <button onClick={() => setSort(k)} className={cn("uppercase", sort === k ? "text-primary" : "hover:text-foreground")}>
        {children}{sort === k && " ▾"}
      </button>
    </th>
  );
}

function FragmentRow({ open, onToggle, detail, children }: { open: boolean; onToggle: () => void; detail: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <tr onClick={onToggle} className={cn("cursor-pointer border-b border-border/50 hover:bg-secondary/40", open && "bg-secondary/40")}>{children}</tr>
      {open && <tr className="border-b border-border/50 bg-secondary/20"><td colSpan={8} className="p-3">{detail}</td></tr>}
    </>
  );
}

function Detail({ r, minLabel }: { r: PlayerStats; minLabel: string }) {
  const d = duelRecord(r), m = matchRecord(r);
  const items: [string, string][] = [
    ["Inscrit le", new Date(r.joined_at).toLocaleDateString("fr-FR")],
    ["Expérience", fmt(r.xp)],
    ["Cartes tirées", fmt(r.cards_pulled)],
    [`${minLabel}+ tirées`, fmt(r.rare_pulled)],
    ["Légendaire+ tirées", fmt(r.legendary_pulled)],
    [`${minLabel}+ possédées`, fmt(r.rare_owned)],
    ["Cartes différentes", fmt(r.unique_owned)],
    ["Duels joués", `${d.played} (${winRate(d)} % gagnés)`],
    ["Classement duel", fmt(r.duel_rating)],
    ["Matchs 11v11", `${r.tactic_wins}-${r.tactic_draws}-${r.tactic_losses}`],
    ["Matchs à la main", `${r.live_wins}-${r.live_draws}-${r.live_losses}`],
    ["Matchs joués", `${m.played} (${winRate(m)} % gagnés)`],
    ["Buts 11v11", `${r.goals_for} marqués / ${r.goals_against} encaissés`],
    ["Classement match", fmt(r.match_rating)],
    ["Ventes au marché", fmt(r.auctions_sold)],
    ["Défis réussis", fmt(r.challenges_claimed)],
    ["Ballons d'Or", fmt(r.ballon_dor)],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-border/30 pb-1">
          <dt className="text-muted-foreground">{k}</dt><dd className="font-bold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const MEDAL = ["text-gold", "text-foreground", "text-primary"];

function BoardCard({ board, rows, icon, title, hint, unit }: { board: Board; rows: PlayerStats[]; icon: React.ReactNode; title: string; hint: string; unit: [string, string] }) {
  const top = rankBoard(rows, board, 10);
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-2 text-primary">{icon}<h2 className="text-2xl text-foreground">{title}</h2></div>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      {!top.length && <p className="py-4 text-center text-sm text-muted-foreground">Personne pour l'instant.</p>}
      <ol className="space-y-1.5">
        {top.map(({ place, player, value }) => (
          <li key={player.user_id} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", place === 1 ? "bg-primary/15" : "bg-secondary/40")}>
            <span className={cn("w-6 text-center text-lg font-bold", MEDAL[place - 1] ?? "text-muted-foreground")}>{place}</span>
            <span className="flex-1 truncate font-bold text-foreground">{player.username}</span>
            <span className="text-sm"><b className="text-primary">{fmt(value)}</b> <span className="text-muted-foreground">{value > 1 ? unit[1] : unit[0]}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

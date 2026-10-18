import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardTable } from "@/components/LeaderboardTable";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Classement — Goalmaster" },
      { name: "description", content: "Les meilleurs collectionneurs Goalmaster : cartes, légendaires, Shiny et Secrètes Ultimes." },
      { property: "og:title", content: "Classement — Goalmaster" },
      { property: "og:description", content: "Qui possède la plus belle collection ?" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-5xl text-gold">Classement général</h1>
      <div className="panel p-4 sm:p-6">
        <LeaderboardTable limit={100} />
      </div>
    </div>
  ),
});

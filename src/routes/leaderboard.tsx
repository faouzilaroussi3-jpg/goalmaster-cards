import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { DuelLeaderboard } from "@/components/DuelLeaderboard";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Classement — Goalmaster" },
      { name: "description", content: "Les meilleurs collectionneurs Goalmaster et les meilleurs joueurs de duels tactiques." },
      { property: "og:title", content: "Classement — Goalmaster" },
      { property: "og:description", content: "Qui possède la plus belle collection ?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-5xl text-gold">Classement général</h1>
      <div className="panel p-4 sm:p-6">
        <LeaderboardTable limit={100} />
      </div>
      <h2 className="mb-4 mt-10 text-4xl text-gold">Classement des duels</h2>
      <div className="panel p-4 sm:p-6">
        <DuelLeaderboard limit={100} />
      </div>
    </div>
  ),
});

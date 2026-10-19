import { createFileRoute } from "@tanstack/react-router";
import { PlayerCard } from "@/components/PlayerCard";

// TEMPORARY visual check page, removed after verification.
export const Route = createFileRoute("/su-preview")({ component: Page });

const card = { id: "x", name: "Lionel Messi", rarity: "secret_ultimate", rating: 99, club: "Argentine · Sélection", nationality: "Argentine", pos: "BU", image_url: "/__l5e/assets-v1/86574e87-8176-4e61-904f-f21e3a13bb8c/su-photo-messi.jpg", version: "normal" } as never;

function Page() {
  return (
    <div className="grid grid-cols-2 gap-4 p-24 sm:grid-cols-2 md:grid-cols-2" style={{ maxWidth: 1100, paddingTop: 220 }}>
      <PlayerCard card={card} />
      <PlayerCard card={card} />
      <PlayerCard card={card} />
      <PlayerCard card={card} />
    </div>
  );
}

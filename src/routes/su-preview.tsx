import { createFileRoute } from "@tanstack/react-router";
import { PlayerCard } from "@/components/PlayerCard";
import type { CardData } from "@/lib/rarity";

const su = { id: "x", name: "Lionel Messi", club: "Argentine · Sélection", nationality: "Argentine", pos: "BU", rating: 99, rarity: "secret_ultimate", image_url: "/__l5e/assets-v1/86574e87-8176-4e61-904f-f21e3a13bb8c/su-photo-messi.jpg" } as unknown as CardData;
const other = { ...su, id: "y", name: "Joueur Rare", rarity: "rare", rating: 80 } as unknown as CardData;

export const Route = createFileRoute("/su-preview")({ component: Preview });

function Preview() {
  const cards = [other, su, other, other, other, other, su, other];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {cards.map((c, i) => <div key={i}><PlayerCard card={c} /></div>)}
      </div>
    </div>
  );
}

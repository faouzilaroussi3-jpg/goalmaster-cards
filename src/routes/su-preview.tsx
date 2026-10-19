import { createFileRoute } from "@tanstack/react-router";
import { PlayerCard } from "@/components/PlayerCard";
import img from "@/assets/players/Gautier_Larsonneur.jpg.asset.json";

export const Route = createFileRoute("/su-preview")({ component: P });
function P() {
  return <div className="mx-auto w-96 pt-24"><PlayerCard card={{ name: "Test SU", club: "Club", nationality: "France", pos: "BU", rating: 99, rarity: "secret_ultimate", image_url: img.url }} /></div>;
}

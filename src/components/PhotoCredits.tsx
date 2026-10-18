import { PLAYER_PORTRAITS } from "@/lib/player-portraits";

export function PhotoCredits() {
  return (
    <details className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-primary">Crédits photographiques</summary>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {PLAYER_PORTRAITS.map((photo) => (
          <li key={photo.name}>
            <a href={photo.source} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">{photo.name}</a>
            {" — "}{photo.author}{" · "}
            <a href={photo.license_url} target="_blank" rel="noreferrer" className="underline">{photo.license}</a>
            {" · cadrage d’affichage"}
          </li>
        ))}
      </ul>
    </details>
  );
}
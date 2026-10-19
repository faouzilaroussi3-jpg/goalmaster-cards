import { PLAYER_PORTRAITS } from "@/lib/player-portraits";
import { EDITION_PHOTO_CREDITS } from "@/lib/edition-photo-credits";

interface CreditedCard {
  name: string;
  image_url: string | null;
  photo_author?: string | null;
  photo_license?: string | null;
  photo_license_url?: string | null;
  photo_source?: string | null;
  alt_image_url?: string | null;
  alt_photo_author?: string | null;
  alt_photo_license?: string | null;
  alt_photo_license_url?: string | null;
  alt_photo_source?: string | null;
}

/** Photo credits: curated portraits plus every catalog card that carries its own licence data. */
export function PhotoCredits({ cards = [] }: { cards?: CreditedCard[] }) {
  const fromCards = cards
    .filter((c) => c.photo_source && c.image_url)
    .map((c) => ({ name: c.name, url: c.image_url!, author: c.photo_author ?? "", license: c.photo_license ?? "", license_url: c.photo_license_url ?? c.photo_source!, source: c.photo_source! }));
  const fromAltArt = cards
    .filter((c) => c.alt_photo_source && c.alt_image_url)
    .map((c) => ({ name: `${c.name} (ALT)`, url: c.alt_image_url!, author: c.alt_photo_author ?? "", license: c.alt_photo_license ?? "", license_url: c.alt_photo_license_url ?? c.alt_photo_source!, source: c.alt_photo_source! }));
  const seen = new Set<string>();
  const credits = [...PLAYER_PORTRAITS, ...EDITION_PHOTO_CREDITS, ...fromCards, ...fromAltArt].filter((p) => !seen.has(p.url) && seen.add(p.url));

  return (
    <details className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-primary">Crédits photographiques ({credits.length})</summary>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {credits.map((photo) => (
          <li key={photo.url}>
            <a href={photo.source} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">{photo.name}</a>
            {" — "}{photo.author}{" · "}
            {photo.license_url ? (
              <a href={photo.license_url} target="_blank" rel="noreferrer" className="underline">{photo.license}</a>
            ) : (
              photo.license
            )}
            {" · Wikimedia Commons · cadrage d’affichage"}
          </li>
        ))}
      </ul>
    </details>
  );
}

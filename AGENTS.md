<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Goalmaster architecture
- All game logic (draws, pack stock regen, purchases) lives in SECURITY DEFINER Postgres functions (open_pack, get_my_packs, buy_pack); clients only call them via rpc — keeps probabilities server-side and row locks prevent double openings.
- Pack regen is computed lazily from last_regen_at on each call, so it works while players are offline without cron.
- Rarities, pack types and rates are data rows (rarities, pack_types) so new tiers/packs need no code change; frontend styling keys off rarity key in src/styles.css.
- PlayerCard is the shared presentation for collection and pack results; container queries keep names legible at different card sizes, and rarity-token effects respect reduced motion.
- Downloaded player portraits use asset pointers with provenance in player-portraits; collection credits expose author/source/license, and catalog replacements preserve card IDs and game rarity ratings.
- Catalog edition data is curated in a browser-safe module and applied to existing card IDs; tests validate player-tier eligibility and distinct star-edition photographs without changing pack probabilities.
- Tearing a pack goes straight from the light burst to the face-down reveal stack (no cinematic in between), so opening stays fast and lightweight.
- Pack tear-to-open thresholds (left-to-right on the top strip) live in src/lib/pack-swipe.ts as pure functions with tests, so gesture tuning never touches the component or the server draw.
- Pack results are revealed from a tap-to-flip stack (CardBack + src/lib/card-reveal.ts timings, bonus card last); reveal suspense is presentation only and never affects the server draw.
- Bulk catalog expansions are recorded in src/data/*.json (Wikidata ID, licensed Commons photo pointer, credit fields) and inserted as card rows carrying photo_author/photo_license/photo_source, so credits come from the database instead of hand-written modules.
- Secret Ultimate secrecy is enforced by the cards SELECT policy (owner or admin only) and by excluding the tier from public feeds/leaderboard UI, so the tier never leaks through client code.
- ALT editions store their own art in cards.alt_image_url; open_pack/get_recent_drops resolve the image per version server-side, and PlayerCard falls back to the normal art only when no ALT art exists.
- Rare-tier frames (gold, rainbow ALT, diamond + orbiting gem, navy/white neon-invert Shiny, fire SU) are CSS plus SVG overlays in src/components/RareCardFx.tsx keyed off data-rarity/data-version; SU fire is a per-card canvas particle system (src/components/CardFire.tsx) paused off-screen; motion is skipped under reduced motion.
- The SU dragons (several per card, each with its own random flight) are a CC0 Quaternius GLB rendered with React Three Fiber (src/components/Dragon3D.tsx) in a transparent overlay that overflows the card (sizes in src/lib/dragon-orbit.ts, per-card random flight in src/lib/dragon-flight.ts with tests, procedural triplanar scale skin in the material shader); a depth-only card plane hides them behind the card, and the overlay is lazy-loaded, mounted only on screen and after hydration, so three.js never runs during SSR or for off-screen cards.
- Secret Ultimate photo credits live only on the card rows (photo_* columns), never in client-side credit lists, so credits cannot reveal the hidden tier.

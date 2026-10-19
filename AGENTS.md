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
- The opening cinematic lazy-loads React Three Fiber and a locally hosted CC0 rigged human; its frame-driven camera and effects use the highest returned card tier, and completion follows model-ready animation time with skip/reduced-motion support, never changing draws.
- Pack tear-to-open thresholds (left-to-right on the top strip) live in src/lib/pack-swipe.ts as pure functions with tests, so gesture tuning never touches the component or the server draw.
- Pack results are revealed from a tap-to-flip stack (CardBack + src/lib/card-reveal.ts timings, bonus card last); reveal suspense is presentation only and never affects the server draw.

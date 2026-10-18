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

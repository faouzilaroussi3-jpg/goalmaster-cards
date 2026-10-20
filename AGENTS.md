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
- Subdirectories have their own `AGENTS.md` (e.g. src/components); read it before changing files there.
- Game logic (draws, pack stock, purchases, rewards) lives only in SECURITY DEFINER Postgres functions called via rpc: probabilities stay server-side and row locks prevent double spends.
- Time-based state (pack regen, auction/duel timeouts, challenge periods) is computed lazily on each call, so no cron is needed.
- Rarities, pack types and rates are data rows (ALT/Shiny chances in pack_types.version_rates; bonus_rates deprecated). Switched-off rarities (rarities.active, set only via admin_set_rarity_active) are skipped inside _draw_key, mirrored by activeRates in src/lib/rarity-admin.ts. Admins add/edit/remove rarities only via admin_create_rarity/admin_update_rarity/admin_delete_rarity (built-ins can't be deleted; editing a built-in changes only its look, it still plays as its own key via _rarity_fx and RarityInfo.play). A rarity's effect is a built-in look or an extra style (RARITY_STYLES in src/lib/rarity.ts) that plays like a built-in base: visuals use the style, gameplay uses the base via _effect_base/_rarity_fx (mirrored, tested); CSS draws styles through .card-style-fx; rank orders rarities, tier is visual intensity.
- Player photos use asset pointers with provenance; credits (author/source/license) live on card rows (photo_*, alt_photo_*), bulk expansions are recorded in src/data/*.json, and catalog edits preserve card IDs. Edition data is a browser-safe module applied to existing card IDs; tests check tier eligibility and distinct star-edition photos without changing pack odds.
- Secret Ultimate secrecy: cards SELECT policy (owner/admin), tier excluded from public feeds/leaderboard/market, credits only on card rows.
- ALT art is cards.alt_image_url, resolved per version server-side; PlayerCard falls back to normal art.
- Admin card photos are resized in the browser into the private card-photos bucket, served by src/routes/api/public/card-photo/$.ts (random UUID names only).
- Players may only UPDATE username/avatar_url on profiles, so coins cannot be edited client-side.
- Feature rules are mirrored as pure helpers in src/lib/<feature>.ts with tests in src/test (transfer-market, challenges, periodic-challenges, duel, friends, admin-grants).
- Transfer market: auctions/auction_bids via create_auction, place_bid, cancel_auction, get_auctions; bids escrow coins, _settle_auctions settles lazily.
- Défis: challenges rows (metric, target, reward) with progress counted from pack_openings.results (transfers never count); claims are unique per user and paid only by claim_* functions. Daily/weekly ones are periodic_challenges (period, slot, coins + packs): rotation (one per period/slot) and Paris-time bounds are computed in SQL, claims unique per period_start.
- Duels: duels/duel_decks/duel_moves/duel_stats via create_duel, accept_duel, play_card, leave_duel, get_duel, get_my_duels; frozen decks, hidden moves, rewards/Elo in _finish_duel with a daily cap.
- Sound: Web Audio synthesis in src/lib/sfx.ts (no files); one document listener from __root sounds every control, data-sfx="none" opts out, mute stored in localStorage.
- Friends/messages: written only via SECURITY DEFINER functions; RLS limits reads to participants, messages need an accepted friendship; AppHeader owns the single realtime subscription.
- Admin gifts: only via admin_grant (logged in admin_grants); gifted packs may exceed max_stock, gifted cards never count for Défis or live pulls; players notified via claim_gift_notices from AppHeader.

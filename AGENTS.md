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
- Rarities, pack types and rates are data rows (ALT/Shiny chances in pack_types.version_rates; bonus_rates deprecated). Switched-off rarities (set only via admin_set_rarity_active) are skipped in _draw_key, mirrored by activeRates in src/lib/rarity-admin.ts. Rarities change only via admin_create/update/delete_rarity (built-ins not deletable; editing one changes only its look). An effect is a built-in look or a RARITY_STYLES style that plays like a built-in base (_effect_base/_rarity_fx, mirrored, tested); extra_effects are looks only; rank orders rarities, tier is visual intensity.
- Client lists that can exceed 1 000 rows (cards, user_cards) load through fetchAll in src/lib/fetch-all.ts: the API caps each request at 1 000 rows.
- Player photos use asset pointers; credits (author/source/license) live on card rows (photo_*, alt_photo_*), bulk expansions are recorded in src/data/*.json, catalog edits preserve card IDs. ALT art is cards.alt_image_url (falls back to normal art).
- Secret Ultimate secrecy: cards SELECT policy (owner/admin), tier excluded from public feeds, leaderboard, market and announcements.
- Uploaded photos (cards, packs, backs) are resized in the browser into the private card-photos bucket, served by src/routes/api/public/card-photo/$.ts (random UUID names only).
- Players may only UPDATE username/avatar_url on profiles, so coins cannot be edited client-side.
- Feature rules are mirrored as pure helpers in src/lib/<feature>.ts with tests in src/test.
- Transfer market: create_auction, place_bid, cancel_auction, get_auctions, get_auction_bids; bids escrow coins, _settle_auctions settles lazily.
- Défis: progress counted from pack_openings.results (transfers never count), paid only by claim_* functions; daily/weekly periodic_challenges rotate and use Paris-time bounds in SQL, claims unique per period_start. Admin special challenges are periodic_challenges rows with period 'special' and their own starts_at/ends_at window (created/ended only via admin_create/end_special_challenge), so they reuse the same progress, claim and header-badge paths.
- Duels: create_duel/accept_duel/play_card/leave_duel/get_duel; frozen decks, hidden moves, rewards/Elo in _finish_duel with a daily cap.
- Sound: Web Audio synthesis in src/lib/sfx.ts (no files); one document listener from __root sounds every control, data-sfx="none" opts out.
- Friends/messages, admin gifts (admin_grant) and announcements are written only by SECURITY DEFINER functions or triggers; AppHeader owns their realtime subscriptions and toasts. Gifted cards never count for Défis or live pulls.
- Steered matches (live_matches): the engine runs in the browser (src/lib/live-match.ts, input via src/lib/pad.ts); the home player hosts live games over a broadcast channel. The server snapshots teams, builds bots, checks timing, reconciles both reports (mismatch = draw) and pays via _lm_finish under the shared daily cap.
- Nouveautés: announcements are written by triggers on cards (merged within 30 min), rarities and pack_types (first time playable); rules in src/lib/news.ts, seen state via mark_news_seen.
- Each pack has a card back look (pack_types.card_back, read through cardBackOf in src/lib/card-back.ts); looks only, never revealing the rarity.
- Commune–Super Rare player cards: rarity and rating come from a strength ranking (club, league, fame, age) with non-overlapping bands in src/lib/card-ratings.ts; rebalances keep each rarity's card count so pack pools and rates stay unchanged, and src/data/*.json plus catalog-editions.ts mirror the cards rows.
- Avatars (avatars table, written only by save_avatar) are looks only; a club kit unlocks from the clubs in the player's own pack_openings.results (_kit_clubs), never from gifts or transfers. Kit colours are keyword-matched evocations in src/lib/kits.ts (no logos), option lists in src/lib/avatar.ts mirror the SQL checks.
- Ballon d'Or ceremonies (ballon_dor_ceremonies) are scheduled/started/awarded/cancelled only by admin_*_ballon_dor functions (one live at a time, award pays coins and is the trophy record); the hall's audience is a Realtime presence room, not stored, and AppHeader owns the table's realtime subscription.

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
- All game logic (draws, pack stock regen, purchases) lives in SECURITY DEFINER Postgres functions (open_pack, get_my_packs, buy_pack); clients only call them via rpc — keeps probabilities server-side and row locks prevent double openings.
- Pack regen is computed lazily from last_regen_at on each call, so it works while players are offline without cron.
- Rarities, pack types and rates are data rows (rarities, pack_types) so new tiers/packs need no code change; frontend styling keys off rarity key in src/styles.css.
- Downloaded player portraits use asset pointers with provenance in player-portraits; collection credits expose author/source/license, and catalog replacements preserve card IDs and game rarity ratings.
- Catalog edition data is curated in a browser-safe module and applied to existing card IDs; tests validate player-tier eligibility and distinct star-edition photographs without changing pack probabilities.
- Tearing a pack goes straight from the light burst to the face-down reveal stack (no cinematic), so opening stays fast; a quick-open button (PackOpening instant) skips tear and stack straight to the summary; tear thresholds live in src/lib/pack-swipe.ts as pure functions with tests.
- Pack results are revealed from a tap-to-flip stack (CardBack + src/lib/card-reveal.ts timings) in the order open_pack returns (least rare first, slot field); ALT/Shiny chances are per-pack data in pack_types.version_rates, bonus_rates is deprecated; reveal suspense is presentation only.
- Bulk catalog expansions are recorded in src/data/*.json (Wikidata ID, licensed Commons photo pointer, credit fields) and inserted as card rows carrying photo_* (and alt_photo_* for ALT art), so credits come from the database.
- Secret Ultimate secrecy is enforced by the cards SELECT policy (owner or admin only), by excluding the tier from public feeds/leaderboard/market, and by keeping its photo credits only on card rows, so the tier never leaks through client code.
- ALT editions store their own art in cards.alt_image_url; server functions resolve the image per version, and PlayerCard falls back to the normal art only when no ALT art exists.
- Admin-uploaded card photos are resized in the browser and stored in the private card-photos bucket (public buckets are blocked in this workspace); src/routes/api/public/card-photo/$.ts serves them and only accepts random UUID file names.
- The transfer market (auctions, auction_bids) runs only through SECURITY DEFINER functions (create_auction, place_bid, cancel_auction, get_auctions); bids escrow coins and refund the outbid player, ended auctions settle lazily (_settle_auctions, also run from get_my_packs) so no cron is needed. Players may only UPDATE username/avatar_url on profiles so coins cannot be edited client-side. UI rules mirror the DB in src/lib/transfer-market.ts with tests.
- Pack challenges (Défis) are data rows in challenges (metric total/rarity/version, target, reward); progress is counted server-side from pack_openings.results (every pulled copy, so transfers never count), rewards are paid only via claim_challenge/claim_all_challenges with a unique claim row per user, and secret challenges stay hidden until the player has progress. UI rules mirror the DB in src/lib/challenges.ts with tests.
- Tactical duels (duels, duel_decks, duel_moves, duel_stats) run only through SECURITY DEFINER functions (create_duel, accept_duel, play_card, leave_duel, get_duel, get_my_duels); decks are frozen snapshots and moves stay hidden until both players play, timeouts settle lazily (_settle_duels) without cron, and rewards/Elo are paid in _finish_duel with a daily rewarded-duel cap. Rules are mirrored in src/lib/duel.ts with tests.
- Sound effects are synthesized with the Web Audio API in src/lib/sfx.ts (no audio files); one document listener installed from __root gives every button/link/tab a sound and toasts a chime, elements with a dedicated sound opt out with data-sfx="none", and the mute choice is stored in localStorage.
- Friends and private messages (friendships, messages) are written only through SECURITY DEFINER functions (send_friend_request, respond_friend_request, remove_friend, send_message, mark_messages_read); RLS lets each player read only rows they are part of, messages require an accepted friendship, and AppHeader owns the single realtime subscription for both tables. Limits are mirrored in src/lib/friends.ts with tests.
- Admin gifts (packs, coins, card copies to one or all players) go only through the admin-checked SECURITY DEFINER admin_grant, logged in admin_grants; gifted packs may exceed max_stock and gifted cards never count for Défis or live pulls (no pack_opening). Players are notified via claim_gift_notices from AppHeader (on load + realtime). Per-send limits are mirrored in src/lib/admin-grants.ts with tests.

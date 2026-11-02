-- Reorder rarities: the admin sends every rarity key from least to most rare; the existing rank values are handed out again in that order.
CREATE OR REPLACE FUNCTION public.admin_reorder_rarities(_keys text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  PERFORM 1 FROM public.rarities FOR UPDATE;
  SELECT count(*) INTO n FROM public.rarities;
  IF _keys IS NULL OR cardinality(_keys) <> n
     OR (SELECT count(DISTINCT k) FROM unnest(_keys) k) <> n
     OR EXISTS (SELECT 1 FROM unnest(_keys) k WHERE NOT EXISTS (SELECT 1 FROM public.rarities r WHERE r.key = k)) THEN
    RAISE EXCEPTION 'Le classement doit contenir chaque rareté une seule fois';
  END IF;
  WITH wanted AS (SELECT k, i FROM unnest(_keys) WITH ORDINALITY AS t(k, i)),
       slots AS (SELECT rank, row_number() OVER (ORDER BY rank, key) AS i FROM public.rarities)
  UPDATE public.rarities r SET rank = s.rank
  FROM wanted w JOIN slots s ON s.i = w.i
  WHERE r.key = w.k;
END $$;

REVOKE ALL ON FUNCTION public.admin_reorder_rarities(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_rarities(text[]) TO authenticated;

-- Légendaires pulled now follow Légendaire's current place in the ranking instead of a fixed number.
CREATE OR REPLACE FUNCTION public.admin_player_stats(_min_rank numeric DEFAULT 3)
RETURNS TABLE(
  user_id uuid, username text, level integer, xp integer, coins integer, joined_at timestamptz, is_admin boolean,
  packs_opened bigint, cards_pulled bigint, rare_pulled bigint, legendary_pulled bigint,
  cards_owned bigint, unique_owned bigint, rare_owned bigint,
  duel_wins integer, duel_losses integer, duel_draws integer, duel_rating integer,
  tactic_wins integer, tactic_losses integer, tactic_draws integer, goals_for integer, goals_against integer, match_rating integer,
  live_wins bigint, live_losses bigint, live_draws bigint,
  auctions_sold bigint, ballon_dor bigint, challenges_claimed bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  legend_rank numeric := coalesce((select rank from public.rarities where key = 'legendary'), 5);
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  return query
  with pulls as (
    select po.user_id as uid, count(distinct po.id) as packs, count(r.x) as pulled,
      count(r.x) filter (where coalesce(ra.rank, (r.x->>'rank')::numeric, 0) >= _min_rank) as rare,
      count(r.x) filter (where coalesce(ra.rank, (r.x->>'rank')::numeric, 0) >= legend_rank) as legend
    from public.pack_openings po
    cross join lateral jsonb_array_elements(po.results) as r(x)
    left join public.rarities ra on ra.key = r.x->>'rarity'
    group by po.user_id
  ), owned as (
    select uc.user_id as uid, count(*) as total, count(distinct (uc.card_id, uc.version)) as uniq,
      count(*) filter (where coalesce(ra.rank, 0) >= _min_rank) as rare
    from public.user_cards uc
    join public.cards c on c.id = uc.card_id
    left join public.rarities ra on ra.key = c.rarity
    group by uc.user_id
  ), live as (
    select s.uid,
      count(*) filter (where lm.winner_id = s.uid) as w,
      count(*) filter (where lm.result is distinct from 'draw' and lm.winner_id is distinct from s.uid) as l,
      count(*) filter (where lm.result = 'draw') as d
    from public.live_matches lm
    cross join lateral (values (lm.home_id), (lm.away_id)) as s(uid)
    where lm.status = 'finished' and s.uid is not null
    group by s.uid
  ), sold as (
    select a.seller_id as uid, count(*) as n from public.auctions a where a.status = 'sold' group by a.seller_id
  ), bdo as (
    select b.winner_id as uid, count(*) as n from public.ballon_dor_ceremonies b where b.status = 'finished' and b.winner_id is not null group by b.winner_id
  ), ch as (
    select x.uid, count(*) as n from (
      select cc.user_id as uid from public.challenge_claims cc
      union all select pc.user_id from public.periodic_challenge_claims pc
    ) x group by x.uid
  )
  select p.id, p.username, p.level, p.xp, p.coins, p.created_at, public.has_role(p.id, 'admin'),
    coalesce(pu.packs, 0), coalesce(pu.pulled, 0), coalesce(pu.rare, 0), coalesce(pu.legend, 0),
    coalesce(o.total, 0), coalesce(o.uniq, 0), coalesce(o.rare, 0),
    coalesce(ds.wins, 0), coalesce(ds.losses, 0), coalesce(ds.draws, 0), coalesce(ds.rating, 1000),
    coalesce(ms.wins, 0), coalesce(ms.losses, 0), coalesce(ms.draws, 0), coalesce(ms.goals_for, 0), coalesce(ms.goals_against, 0), coalesce(ms.rating, 1000),
    coalesce(lv.w, 0), coalesce(lv.l, 0), coalesce(lv.d, 0),
    coalesce(so.n, 0), coalesce(bd.n, 0), coalesce(ch.n, 0)
  from public.profiles p
  left join pulls pu on pu.uid = p.id
  left join owned o on o.uid = p.id
  left join public.duel_stats ds on ds.user_id = p.id
  left join public.match_stats ms on ms.user_id = p.id
  left join live lv on lv.uid = p.id
  left join sold so on so.uid = p.id
  left join bdo bd on bd.uid = p.id
  left join ch on ch.uid = p.id
  order by p.username;
end $$;

REVOKE ALL ON FUNCTION public.admin_player_stats(numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_player_stats(numeric) TO authenticated;
-- Big pulls: any rarity ranked at or above Légendaire counts (custom rarities included), Secrète Ultime-like ones stay hidden.
CREATE OR REPLACE FUNCTION public._is_big_pull(_rarity text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT r.rank >= (SELECT l.rank FROM public.rarities l WHERE l.key = 'legendary') FROM public.rarities r WHERE r.key = _rarity), false)
    AND _rarity <> 'secret_ultimate' AND public._rarity_fx(_rarity) <> 'secret_ultimate'
$$;

CREATE OR REPLACE FUNCTION public._record_big_pulls()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN RETURN NEW; END IF;
  IF coalesce(jsonb_array_length(OLD.results), 0) = 0 AND coalesce(jsonb_array_length(NEW.results), 0) > 0 THEN
    INSERT INTO public.big_pulls (opening_id, user_id, card_id, name, club, nationality, pos, rating, rarity, version, image_url, pack_key, pulled_at)
    SELECT NEW.id, NEW.user_id, (e->>'card_id')::uuid, e->>'name', e->>'club', e->>'nationality', e->>'pos', (e->>'rating')::int,
      e->>'rarity', coalesce(e->>'version', 'normal'), e->>'image_url', pt.key, now()
    FROM jsonb_array_elements(NEW.results) e
    LEFT JOIN public.pack_types pt ON pt.id = NEW.pack_type_id
    WHERE public._is_big_pull(e->>'rarity');
  END IF;
  RETURN NEW;
END $function$;

-- Backfill the custom-rarity pulls the old tier-based rule missed.
INSERT INTO public.big_pulls (opening_id, user_id, card_id, name, club, nationality, pos, rating, rarity, version, image_url, pack_key, pulled_at)
SELECT o.id, o.user_id, (e->>'card_id')::uuid, e->>'name', e->>'club', e->>'nationality', e->>'pos', (e->>'rating')::int,
  e->>'rarity', coalesce(e->>'version', 'normal'), e->>'image_url', pt.key, o.created_at
FROM public.pack_openings o
CROSS JOIN LATERAL jsonb_array_elements(o.results) e
LEFT JOIN public.pack_types pt ON pt.id = o.pack_type_id
WHERE public._is_big_pull(e->>'rarity')
  AND NOT public.has_role(o.user_id, 'admin')
  AND (e->>'card_id') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.big_pulls b WHERE b.opening_id = o.id AND b.card_id = (e->>'card_id')::uuid AND b.version = coalesce(e->>'version', 'normal'));

DROP FUNCTION IF EXISTS public.get_big_pulls(integer);
CREATE FUNCTION public.get_big_pulls(_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, card_id uuid, name text, club text, nationality text, pos text, rating integer, rarity text, version text, image_url text, pack_key text, pack_name text, pulled_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT b.id, p.username, b.card_id, b.name, b.club, b.nationality, b.pos, b.rating, b.rarity, b.version, b.image_url, b.pack_key, pt.name, b.pulled_at
  FROM public.big_pulls b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.pack_types pt ON pt.key = b.pack_key
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = b.user_id AND r.role = 'admin')
    AND public._is_big_pull(b.rarity)
  ORDER BY b.pulled_at DESC
  LIMIT least(greatest(_limit, 1), 200)
$function$;
REVOKE ALL ON FUNCTION public.get_big_pulls(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_big_pulls(integer) TO anon, authenticated;

-- Auction bid history: who bid, how much, when (any signed-in player can read it).
CREATE OR REPLACE FUNCTION public.get_auction_bids(_auction_id uuid)
RETURNS TABLE(bid_id uuid, username text, amount integer, created_at timestamptz, is_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  return query
    select b.id, p.username, b.amount, b.created_at, b.bidder_id = uid
    from public.auction_bids b
    left join public.profiles p on p.id = b.bidder_id
    where b.auction_id = _auction_id
    order by b.created_at desc, b.amount desc
    limit 200;
end $$;
REVOKE ALL ON FUNCTION public.get_auction_bids(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_auction_bids(uuid) TO authenticated;
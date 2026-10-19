-- Players may only edit their name/avatar themselves; coins, xp and level change only through game functions.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, avatar_url) ON public.profiles TO authenticated;

CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  user_card_id uuid NOT NULL REFERENCES public.user_cards(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT 'normal',
  start_price integer NOT NULL,
  current_bid integer,
  current_bidder uuid,
  bid_count integer NOT NULL DEFAULT 0,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  seller_received integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CONSTRAINT auctions_status_chk CHECK (status IN ('active','sold','expired','cancelled')),
  CONSTRAINT auctions_price_chk CHECK (start_price >= 10)
);
CREATE UNIQUE INDEX auctions_one_active_per_copy ON public.auctions(user_card_id) WHERE status = 'active';
CREATE INDEX auctions_active_ends ON public.auctions(ends_at) WHERE status = 'active';
CREATE INDEX auctions_seller ON public.auctions(seller_id, created_at DESC);

CREATE TABLE public.auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auction_bids_auction ON public.auction_bids(auction_id, amount DESC);
CREATE INDEX auction_bids_bidder ON public.auction_bids(bidder_id, created_at DESC);

GRANT SELECT ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;
GRANT SELECT ON public.auction_bids TO authenticated;
GRANT ALL ON public.auction_bids TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own auctions readable" ON public.auctions FOR SELECT TO authenticated USING (seller_id = auth.uid() OR current_bidder = auth.uid());
CREATE POLICY "own bids readable" ON public.auction_bids FOR SELECT TO authenticated USING (bidder_id = auth.uid());

-- Escrowed coins go back to the leading bidder if an active auction disappears (e.g. admin deletes the card).
CREATE OR REPLACE FUNCTION public._auction_refund_on_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if old.status = 'active' and old.current_bidder is not null then
    update public.profiles set coins = coins + old.current_bid where id = old.current_bidder;
  end if;
  return old;
end $$;
CREATE TRIGGER auctions_refund_on_delete BEFORE DELETE ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public._auction_refund_on_delete();

-- Seller payout after the 5% transfer tax.
CREATE OR REPLACE FUNCTION public.auction_payout(_amount integer) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ select floor(_amount * 0.95)::int $$;

-- Smallest valid next bid: the starting price, then +5% (at least +10 coins).
CREATE OR REPLACE FUNCTION public.auction_min_bid(_start integer, _current integer) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  select case when _current is null then _start else _current + greatest(10, ceil(_current * 0.05)::int) end
$$;

-- Lazily close every auction whose time is up: card to the winner, 95% to the seller.
CREATE OR REPLACE FUNCTION public._settle_auctions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a record; pay integer;
begin
  for a in select * from public.auctions where status = 'active' and ends_at <= now() order by ends_at for update skip locked loop
    if a.current_bidder is not null then
      pay := public.auction_payout(a.current_bid);
      update public.user_cards set user_id = a.current_bidder, obtained_at = now() where id = a.user_card_id;
      update public.profiles set coins = coins + pay where id = a.seller_id;
      update public.auctions set status = 'sold', seller_received = pay, settled_at = now() where id = a.id;
    else
      update public.auctions set status = 'expired', settled_at = now() where id = a.id;
    end if;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.create_auction(_user_card_id uuid, _start_price integer, _hours integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid(); uc record; new_id uuid;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  perform public._settle_auctions();
  if _hours not in (1, 6, 24, 72) then raise exception 'Durée invalide'; end if;
  if _start_price is null or _start_price < 10 or _start_price > 10000000 then raise exception 'Prix de départ invalide (minimum 10 pièces)'; end if;
  select u.id, u.card_id, u.version, c.rarity into uc
    from public.user_cards u join public.cards c on c.id = u.card_id
    where u.id = _user_card_id and u.user_id = uid for update of u;
  if not found then raise exception 'Cette carte ne t''appartient pas'; end if;
  if uc.rarity = 'secret_ultimate' then raise exception 'Cette carte ne peut pas être mise en vente'; end if;
  if exists (select 1 from public.auctions where user_card_id = _user_card_id and status = 'active') then
    raise exception 'Cet exemplaire est déjà en vente';
  end if;
  insert into public.auctions (seller_id, user_card_id, card_id, version, start_price, ends_at)
    values (uid, uc.id, uc.card_id, uc.version, _start_price, now() + make_interval(hours => _hours))
    returning id into new_id;
  return new_id;
end $$;

CREATE OR REPLACE FUNCTION public.place_bid(_auction_id uuid, _amount integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid(); a public.auctions%rowtype; need integer; bal integer;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  perform public._settle_auctions();
  select * into a from public.auctions where id = _auction_id for update;
  if not found then raise exception 'Enchère introuvable'; end if;
  if a.status <> 'active' or a.ends_at <= now() then raise exception 'Cette enchère est terminée'; end if;
  if a.seller_id = uid then raise exception 'Tu ne peux pas enchérir sur ta propre carte'; end if;
  if _amount is null or _amount < public.auction_min_bid(a.start_price, a.current_bid) then
    raise exception 'Enchère minimum : % pièces', public.auction_min_bid(a.start_price, a.current_bid);
  end if;
  -- Raising your own winning bid only costs the difference.
  need := case when a.current_bidder = uid then _amount - a.current_bid else _amount end;
  select coins into bal from public.profiles where id = uid for update;
  if bal < need then raise exception 'Pas assez de pièces'; end if;
  if a.current_bidder is not null and a.current_bidder <> uid then
    update public.profiles set coins = coins + a.current_bid where id = a.current_bidder;
  end if;
  update public.profiles set coins = coins - need where id = uid;
  update public.auctions set current_bid = _amount, current_bidder = uid, bid_count = bid_count + 1,
    ends_at = greatest(ends_at, now() + interval '2 minutes')
    where id = a.id;
  insert into public.auction_bids (auction_id, bidder_id, amount) values (a.id, uid, _amount);
end $$;

CREATE OR REPLACE FUNCTION public.cancel_auction(_auction_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid(); a public.auctions%rowtype;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  select * into a from public.auctions where id = _auction_id for update;
  if not found or a.seller_id <> uid then raise exception 'Enchère introuvable'; end if;
  if a.status <> 'active' then raise exception 'Cette enchère est terminée'; end if;
  if a.bid_count > 0 then raise exception 'Impossible d''annuler : il y a déjà une enchère'; end if;
  update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
end $$;

-- Market feed. _scope: 'market' (open auctions), 'selling' (my sales), 'bidding' (auctions I bid on).
CREATE OR REPLACE FUNCTION public.get_auctions(_scope text DEFAULT 'market') RETURNS TABLE(
  auction_id uuid, card_id uuid, name text, club text, nationality text, pos text, rating integer,
  rarity text, tier integer, image_url text, version text,
  seller_name text, is_mine boolean, start_price integer, current_bid integer, bidder_name text,
  i_lead boolean, i_bid boolean, bid_count integer, min_bid integer, ends_at timestamptz,
  status text, seller_received integer, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  perform public._settle_auctions();
  return query
  select a.id, c.id, c.name, c.club, c.nationality, c.pos, c.rating, c.rarity, ra.tier,
    case when a.version = 'alt' then coalesce(c.alt_image_url, c.image_url) else c.image_url end,
    a.version, sp.username, a.seller_id = uid, a.start_price, a.current_bid, bp.username,
    a.current_bidder = uid,
    exists (select 1 from public.auction_bids b where b.auction_id = a.id and b.bidder_id = uid),
    a.bid_count, public.auction_min_bid(a.start_price, a.current_bid), a.ends_at,
    a.status, case when a.seller_id = uid then a.seller_received end, a.created_at
  from public.auctions a
  join public.cards c on c.id = a.card_id
  join public.rarities ra on ra.key = c.rarity
  left join public.profiles sp on sp.id = a.seller_id
  left join public.profiles bp on bp.id = a.current_bidder
  where c.rarity <> 'secret_ultimate'
    and case _scope
      when 'market' then a.status = 'active'
      when 'selling' then a.seller_id = uid and a.created_at > now() - interval '30 days'
      when 'bidding' then exists (select 1 from public.auction_bids b where b.auction_id = a.id and b.bidder_id = uid)
        and a.created_at > now() - interval '30 days'
      else false end
  order by case when a.status = 'active' then 0 else 1 end, a.ends_at
  limit 300;
end $$;

-- Copies I currently have listed, so the collection and sell dialog can mark them.
CREATE OR REPLACE FUNCTION public.get_my_listed_copies() RETURNS TABLE(user_card_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select a.user_card_id from public.auctions a where a.seller_id = auth.uid() and a.status = 'active' and a.ends_at > now()
$$;

REVOKE ALL ON FUNCTION public._settle_auctions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._auction_refund_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_auction(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_bid(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_auction(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_auctions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_listed_copies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_auction(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_auction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auctions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_listed_copies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_min_bid(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_payout(integer) TO authenticated;
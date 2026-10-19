CREATE TABLE public.admin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid,
  pack_type_id uuid REFERENCES public.pack_types(id) ON DELETE SET NULL,
  packs integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  card_version text,
  card_copies integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);
CREATE INDEX admin_grants_user_idx ON public.admin_grants (user_id, created_at DESC);
CREATE INDEX admin_grants_created_idx ON public.admin_grants (created_at DESC);

GRANT SELECT ON public.admin_grants TO authenticated;
GRANT ALL ON public.admin_grants TO service_role;
ALTER TABLE public.admin_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gifts readable" ON public.admin_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all gifts" ON public.admin_grants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Players list for the admin gift panel.
CREATE OR REPLACE FUNCTION public.admin_list_players(_q text DEFAULT '')
RETURNS TABLE(user_id uuid, username text, level integer, coins integer, total_packs bigint, is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, p.username, p.level, p.coins,
      coalesce((select sum(s.count) from public.pack_stocks s where s.user_id = p.id), 0)::bigint,
      public.has_role(p.id, 'admin')
    from public.profiles p
    where coalesce(trim(_q), '') = '' or p.username ilike '%' || trim(_q) || '%'
    order by p.username
    limit 100;
end $$;

-- Gives packs, coins and/or card copies to one player or to every player. No cap on how often; per-send sanity limits only.
CREATE OR REPLACE FUNCTION public.admin_grant(
  _user_id uuid, _all boolean, _pack_key text, _packs integer, _coins integer,
  _card_id uuid, _version text, _copies integer, _note text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  me uuid := auth.uid();
  pt public.pack_types%rowtype;
  c public.cards%rowtype;
  v text := coalesce(nullif(_version, ''), 'normal');
  np integer := coalesce(_packs, 0);
  nc integer := coalesce(_coins, 0);
  ncopies integer := coalesce(_copies, 0);
  n text := nullif(trim(coalesce(_note, '')), '');
  target uuid;
  done integer := 0;
  i integer;
begin
  if not public.has_role(me, 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  if np < 0 or np > 10000 then raise exception 'Entre 0 et 10 000 packs par envoi'; end if;
  if nc < 0 or nc > 100000000 then raise exception 'Entre 0 et 100 000 000 pièces par envoi'; end if;
  if ncopies < 0 or ncopies > 100 then raise exception 'Entre 0 et 100 exemplaires de carte par envoi'; end if;
  if np = 0 and nc = 0 and ncopies = 0 then raise exception 'Rien à envoyer'; end if;
  if n is not null and length(n) > 200 then raise exception 'Message de 200 caractères maximum'; end if;
  if np > 0 then
    select * into pt from public.pack_types where key = _pack_key;
    if not found then raise exception 'Pack introuvable'; end if;
  end if;
  if ncopies > 0 then
    select * into c from public.cards where id = _card_id;
    if not found then raise exception 'Carte introuvable'; end if;
    if v not in ('normal', 'alt', 'shiny') then raise exception 'Version inconnue'; end if;
    if v = 'alt' and not c.has_alt then raise exception 'Cette carte n''a pas de version ALT'; end if;
    if v = 'shiny' and not c.has_shiny then raise exception 'Cette carte n''a pas de version Shiny'; end if;
  end if;
  if not coalesce(_all, false) and (_user_id is null or not exists (select 1 from public.profiles where id = _user_id)) then
    raise exception 'Joueur introuvable';
  end if;

  for target in
    select p.id from public.profiles p where (coalesce(_all, false) or p.id = _user_id) order by p.id
  loop
    if np > 0 then
      perform public._sync_stock(target, pt.id);
      update public.pack_stocks set count = count + np where user_id = target and pack_type_id = pt.id;
    end if;
    if nc > 0 then
      update public.profiles set coins = least(coins::bigint + nc, 2000000000)::integer where id = target;
    end if;
    if ncopies > 0 then
      for i in 1 .. ncopies loop
        insert into public.user_cards (user_id, card_id, version) values (target, c.id, v);
      end loop;
      if c.rarity = 'secret_ultimate' and not c.revealed then
        update public.cards set revealed = true where id = c.id;
      end if;
    end if;
    insert into public.admin_grants (user_id, granted_by, pack_type_id, packs, coins, card_id, card_version, card_copies, note)
      values (target, me, case when np > 0 then pt.id end, np, nc, case when ncopies > 0 then c.id end,
              case when ncopies > 0 then v end, ncopies, n);
    done := done + 1;
  end loop;
  return done;
end $$;

-- Returns the gifts the player has not been told about yet and marks them as seen.
CREATE OR REPLACE FUNCTION public.claim_gift_notices()
RETURNS TABLE(grant_id uuid, pack_name text, packs integer, coins integer, card_name text, card_version text, card_copies integer, note text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  return query
    with upd as (
      update public.admin_grants g set seen_at = now()
      where g.user_id = uid and g.seen_at is null
      returning g.*
    )
    select u.id, pt.name, u.packs, u.coins, ca.name, u.card_version, u.card_copies, u.note, u.created_at
    from upd u
    left join public.pack_types pt on pt.id = u.pack_type_id
    left join public.cards ca on ca.id = u.card_id
    order by u.created_at;
end $$;

REVOKE ALL ON FUNCTION public.admin_list_players(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_grant(uuid, boolean, text, integer, integer, uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_gift_notices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_players(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant(uuid, boolean, text, integer, integer, uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gift_notices() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_grants;
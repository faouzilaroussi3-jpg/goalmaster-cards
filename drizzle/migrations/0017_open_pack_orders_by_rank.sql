-- Pack results are now sorted by rarity rank (admin-created rarities slot in between the built-in ones).
CREATE OR REPLACE FUNCTION public.open_pack(_pack_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  pt public.pack_types%rowtype;
  st public.pack_stocks%rowtype;
  op_id uuid;
  drawn jsonb := '[]'::jsonb;
  res jsonb;
  i integer; r text; v text; cid uuid; is_new boolean; dup integer; coins_gain integer := 0;
  c record;
  has_v boolean;
  alt_pct numeric; shiny_pct numeric;
  picked_normal uuid[] := '{}';
  picked_alt uuid[] := '{}';
  picked_shiny uuid[] := '{}';
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  select * into pt from public.pack_types where key = _pack_key and active;
  if not found then raise exception 'Pack introuvable'; end if;
  perform public._sync_stock(uid, pt.id);
  select * into st from public.pack_stocks where user_id = uid and pack_type_id = pt.id for update;
  if st.count < 1 then raise exception 'Aucun pack disponible'; end if;
  update public.pack_stocks set count = count - 1,
    last_regen_at = case when st.count >= pt.max_stock then now() else last_regen_at end
    where id = st.id;

  insert into public.pack_openings (user_id, pack_type_id) values (uid, pt.id) returning id into op_id;

  alt_pct := coalesce((pt.version_rates->>'alt')::numeric, 0);
  shiny_pct := coalesce((pt.version_rates->>'shiny')::numeric, 0);

  -- Exactly slot_count cards, no bonus card. ALT / Shiny are a chance on the drawn Legendary / Secret Legendary.
  for i in 1 .. pt.slot_count loop
    v := 'normal';
    r := public._draw_key(pt.slot_rates);
    cid := public._pick_card(r, picked_normal);
    if cid is null then continue; end if;

    select ca.rarity into r from public.cards ca where ca.id = cid;
    if r = 'legendary' and not (cid = any(picked_alt)) then
      select has_alt into has_v from public.cards where id = cid;
      if has_v and random() * 100 < alt_pct then v := 'alt'; end if;
    elsif r = 'secret_legendary' and not (cid = any(picked_shiny)) then
      select has_shiny into has_v from public.cards where id = cid;
      if has_v and random() * 100 < shiny_pct then v := 'shiny'; end if;
    end if;

    if v = 'alt' then picked_alt := picked_alt || cid;
    elsif v = 'shiny' then picked_shiny := picked_shiny || cid;
    else picked_normal := picked_normal || cid;
    end if;

    select ca.id, ca.name, ca.club, ca.nationality, ca.pos, ca.rating, ca.rarity,
      case when v = 'alt' then coalesce(ca.alt_image_url, ca.image_url) else ca.image_url end as image_url,
      ca.revealed, ra.label as rarity_label, ra.tier, ra.rank, ra.duplicate_coins into c
      from public.cards ca join public.rarities ra on ra.key = ca.rarity where ca.id = cid;
    is_new := not exists (select 1 from public.user_cards where user_id = uid and card_id = cid and version = v);
    dup := case when is_new then 0 else c.duplicate_coins end;
    coins_gain := coins_gain + dup;
    if c.rarity = 'secret_ultimate' and not c.revealed then
      update public.cards set revealed = true where id = cid;
    end if;
    insert into public.user_cards (user_id, card_id, version, opening_id) values (uid, cid, v, op_id);
    drawn := drawn || jsonb_build_array(jsonb_build_object(
      'is_bonus', false, 'card_id', cid, 'name', c.name, 'club', c.club,
      'nationality', c.nationality, 'pos', c.pos, 'rating', c.rating, 'rarity', c.rarity,
      'rarity_label', c.rarity_label, 'tier', c.tier, 'rank', c.rank, 'image_url', c.image_url, 'version', v,
      'is_new', is_new, 'duplicate_coins', dup));
  end loop;

  -- Least rare first, rarest last (special versions after the normal card of the same rarity).
  select coalesce(jsonb_agg(e || jsonb_build_object('slot', n) order by n), '[]'::jsonb) into res
  from (
    select e, row_number() over (
      order by coalesce((e->>'rank')::numeric, (e->>'tier')::numeric), case when e->>'version' = 'normal' then 0 else 1 end, (e->>'rating')::int
    ) as n
    from jsonb_array_elements(drawn) as e
  ) s;

  update public.pack_openings set results = res where id = op_id;
  update public.profiles set coins = coins + coins_gain, xp = xp + pt.xp_reward,
    level = ((xp + pt.xp_reward) / 100) + 1 where id = uid;
  return jsonb_build_object('opening_id', op_id, 'cards', res, 'coins_gained', coins_gain, 'xp_gained', pt.xp_reward);
end $function$;
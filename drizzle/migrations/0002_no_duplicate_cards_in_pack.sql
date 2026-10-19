DROP FUNCTION IF EXISTS public._pick_card(text);

CREATE OR REPLACE FUNCTION public._pick_card(_rarity text, _exclude uuid[] DEFAULT '{}'::uuid[])
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select c.id from public.cards c join public.rarities r on r.key = c.rarity
  where c.active
    and r.tier <= (select tier from public.rarities where key = _rarity)
    and not (c.id = any(coalesce(_exclude, '{}'::uuid[])))
  order by r.tier desc, random() limit 1
$function$;

REVOKE EXECUTE ON FUNCTION public._pick_card(text, uuid[]) FROM PUBLIC, anon, authenticated;

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
  res jsonb := '[]'::jsonb;
  i integer; r text; v text; bk text; cid uuid; is_new boolean; dup integer; coins_gain integer := 0;
  c record;
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

  for i in 1 .. pt.slot_count + 1 loop
    v := 'normal'; cid := null;
    if i <= pt.slot_count then
      r := public._draw_key(pt.slot_rates);
      cid := public._pick_card(r, picked_normal);
    else
      bk := public._draw_key(pt.bonus_rates);
      if bk = 'alt' then
        select id into cid from public.cards where active and has_alt and not (id = any(picked_alt)) order by random() limit 1;
        if cid is not null then v := 'alt'; end if;
      elsif bk = 'shiny' then
        select id into cid from public.cards where active and has_shiny and not (id = any(picked_shiny)) order by random() limit 1;
        if cid is not null then v := 'shiny'; end if;
      elsif bk = 'ultimate' then
        select id into cid from public.cards where active and rarity = 'secret_ultimate' and not (id = any(picked_normal)) order by random() limit 1;
      end if;
      if cid is null then cid := public._pick_card(public._draw_key(pt.slot_rates), picked_normal); end if;
    end if;
    if cid is null then continue; end if;

    if v = 'alt' then picked_alt := picked_alt || cid;
    elsif v = 'shiny' then picked_shiny := picked_shiny || cid;
    else picked_normal := picked_normal || cid;
    end if;

    select ca.id, ca.name, ca.club, ca.nationality, ca.pos, ca.rating, ca.rarity, ca.image_url, ca.revealed,
      ra.label as rarity_label, ra.tier, ra.duplicate_coins into c
      from public.cards ca join public.rarities ra on ra.key = ca.rarity where ca.id = cid;
    is_new := not exists (select 1 from public.user_cards where user_id = uid and card_id = cid and version = v);
    dup := case when is_new then 0 else c.duplicate_coins end;
    coins_gain := coins_gain + dup;
    if c.rarity = 'secret_ultimate' and not c.revealed then
      update public.cards set revealed = true where id = cid;
    end if;
    insert into public.user_cards (user_id, card_id, version, opening_id) values (uid, cid, v, op_id);
    res := res || jsonb_build_array(jsonb_build_object(
      'slot', i, 'is_bonus', i > pt.slot_count, 'card_id', cid, 'name', c.name, 'club', c.club,
      'nationality', c.nationality, 'pos', c.pos, 'rating', c.rating, 'rarity', c.rarity,
      'rarity_label', c.rarity_label, 'tier', c.tier, 'image_url', c.image_url, 'version', v,
      'is_new', is_new, 'duplicate_coins', dup));
  end loop;

  update public.pack_openings set results = res where id = op_id;
  update public.profiles set coins = coins + coins_gain, xp = xp + pt.xp_reward,
    level = ((xp + pt.xp_reward) / 100) + 1 where id = uid;
  return jsonb_build_object('opening_id', op_id, 'cards', res, 'coins_gained', coins_gain, 'xp_gained', pt.xp_reward);
end $function$;
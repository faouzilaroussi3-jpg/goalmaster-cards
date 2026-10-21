-- Per-pack card back look (colour, effects, shape, own picture) used by the face-down reveal stack. Looks only.
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS card_back jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pack_types ADD CONSTRAINT pack_types_card_back_object CHECK (jsonb_typeof(card_back) = 'object');

DROP FUNCTION IF EXISTS public.get_my_packs();
CREATE FUNCTION public.get_my_packs()
 RETURNS TABLE(pack_key text, name text, description text, count integer, max_stock integer, regen_minutes integer, next_at timestamp with time zone, price_coins integer, art text, tint text, effect text, image_url text, slot_count integer, card_back jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); p record;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  perform public._settle_auctions();
  for p in select id from public.pack_types where active and not archived order by sort_order loop
    perform public._sync_stock(uid, p.id);
  end loop;
  return query
    select pt.key, pt.name, pt.description, s.count, pt.max_stock, pt.regen_minutes,
      case when pt.regen_minutes > 0 and s.count < pt.max_stock then s.last_regen_at + make_interval(mins => pt.regen_minutes) else null end,
      pt.price_coins, pt.art, pt.tint, pt.effect, pt.image_url, pt.slot_count, pt.card_back
    from public.pack_types pt join public.pack_stocks s on s.pack_type_id = pt.id and s.user_id = uid
    where pt.active and not pt.archived order by pt.sort_order;
end $function$;
REVOKE ALL ON FUNCTION public.get_my_packs() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_packs() TO authenticated;
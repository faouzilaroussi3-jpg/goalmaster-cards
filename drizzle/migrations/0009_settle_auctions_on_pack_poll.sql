-- The header polls get_my_packs every 30 s, so finished auctions settle promptly without a cron job.
CREATE OR REPLACE FUNCTION public.get_my_packs()
 RETURNS TABLE(pack_key text, name text, description text, count integer, max_stock integer, regen_minutes integer, next_at timestamp with time zone, price_coins integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); p record;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  perform public._settle_auctions();
  for p in select id from public.pack_types where active order by sort_order loop
    perform public._sync_stock(uid, p.id);
  end loop;
  return query
    select pt.key, pt.name, pt.description, s.count, pt.max_stock, pt.regen_minutes,
      case when pt.regen_minutes > 0 and s.count < pt.max_stock then s.last_regen_at + make_interval(mins => pt.regen_minutes) else null end,
      pt.price_coins
    from public.pack_types pt join public.pack_stocks s on s.pack_type_id = pt.id and s.user_id = uid
    where pt.active order by pt.sort_order;
end $function$;
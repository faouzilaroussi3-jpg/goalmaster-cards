-- Admin-customisable packs: base art, tint colour, visual effect, optional own picture; deleted packs with history are archived.
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS art text NOT NULL DEFAULT 'classic';
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS tint text;
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS effect text NOT NULL DEFAULT 'none';
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.pack_types ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
UPDATE public.pack_types SET art = 'premium', effect = 'flames' WHERE key = 'premium';
ALTER TABLE public.pack_types ADD CONSTRAINT pack_types_art_check CHECK (art IN ('classic', 'premium'));
ALTER TABLE public.pack_types ADD CONSTRAINT pack_types_effect_check
  CHECK (effect IN ('none', 'flames', 'glow', 'sparkles', 'neon', 'holo', 'frost', 'shadow'));
ALTER TABLE public.pack_types ADD CONSTRAINT pack_types_tint_check CHECK (tint IS NULL OR tint ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE public.pack_types ADD CONSTRAINT pack_types_slots_check CHECK (slot_count BETWEEN 1 AND 10);

DROP FUNCTION IF EXISTS public.get_my_packs();
CREATE FUNCTION public.get_my_packs()
 RETURNS TABLE(pack_key text, name text, description text, count integer, max_stock integer, regen_minutes integer,
   next_at timestamp with time zone, price_coins integer, art text, tint text, effect text, image_url text, slot_count integer)
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
      pt.price_coins, pt.art, pt.tint, pt.effect, pt.image_url, pt.slot_count
    from public.pack_types pt join public.pack_stocks s on s.pack_type_id = pt.id and s.user_id = uid
    where pt.active and not pt.archived order by pt.sort_order;
end $function$;
REVOKE EXECUTE ON FUNCTION public.get_my_packs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_packs() TO authenticated;

-- Deleting a pack: removed outright when nobody ever opened it, otherwise archived (history and Défis stay intact).
-- Daily/weekly challenges that paid this pack now pay a Classique pack. The last active pack cannot be removed.
CREATE OR REPLACE FUNCTION public.admin_delete_pack(_pack_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pt public.pack_types%rowtype; fallback text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux admins'; END IF;
  SELECT * INTO pt FROM public.pack_types WHERE id = _pack_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pack introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pack_types WHERE id <> pt.id AND active AND NOT archived) THEN
    RAISE EXCEPTION 'Garde au moins un autre pack actif';
  END IF;
  SELECT key INTO fallback FROM public.pack_types WHERE id <> pt.id AND NOT archived ORDER BY (key = 'classic') DESC, sort_order LIMIT 1;
  UPDATE public.periodic_challenges SET reward_pack_key = fallback WHERE reward_pack_key = pt.key;
  UPDATE public.events SET pack_key = NULL WHERE pack_key = pt.key;
  IF EXISTS (SELECT 1 FROM public.pack_openings WHERE pack_type_id = pt.id) THEN
    UPDATE public.pack_types SET archived = true, active = false WHERE id = pt.id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.pack_types WHERE id = pt.id;
  RETURN 'deleted';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_pack(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_pack(uuid) TO authenticated;

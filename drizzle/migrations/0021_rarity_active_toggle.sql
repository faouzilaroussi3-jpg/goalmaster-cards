-- Admins can switch a rarity off: its cards stop dropping from packs (its chance is shared out among the other rarities); owned cards are kept.
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Weighted draw over rarity keys, skipping switched-off rarities.
CREATE OR REPLACE FUNCTION public._draw_key(_w jsonb)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE total numeric; roll numeric; acc numeric := 0; k text; val numeric; last_k text;
BEGIN
  SELECT sum(e.value::numeric) INTO total FROM jsonb_each_text(_w) e
    WHERE NOT EXISTS (SELECT 1 FROM public.rarities ra WHERE ra.key = e.key AND NOT ra.active);
  IF total IS NULL OR total <= 0 THEN RETURN NULL; END IF;
  roll := random() * total;
  FOR k, val IN SELECT e.key, e.value::numeric FROM jsonb_each_text(_w) e
    WHERE NOT EXISTS (SELECT 1 FROM public.rarities ra WHERE ra.key = e.key AND NOT ra.active) LOOP
    acc := acc + val; last_k := k;
    IF roll < acc THEN RETURN k; END IF;
  END LOOP;
  RETURN last_k;
END $$;
REVOKE EXECUTE ON FUNCTION public._draw_key(jsonb) FROM PUBLIC, anon, authenticated;

-- Switch a rarity on or off. Refuses to switch off the last rarity an active pack can still drop.
CREATE OR REPLACE FUNCTION public.admin_set_rarity_active(_key text, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE blocked text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'Valeur manquante'; END IF;
  PERFORM 1 FROM public.rarities WHERE key = _key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rareté introuvable'; END IF;
  IF NOT _active THEN
    SELECT pt.name INTO blocked FROM public.pack_types pt
    WHERE pt.active AND NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(pt.slot_rates) e JOIN public.rarities ra ON ra.key = e.key
      WHERE ra.active AND ra.key <> _key AND e.value::numeric > 0)
    LIMIT 1;
    IF blocked IS NOT NULL THEN
      RAISE EXCEPTION 'Impossible : le pack « % » n''aurait plus aucune rareté à tirer', blocked;
    END IF;
  END IF;
  UPDATE public.rarities SET active = _active WHERE key = _key;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_rarity_active(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_rarity_active(text, boolean) TO authenticated;
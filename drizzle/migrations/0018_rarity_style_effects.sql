-- 8 extra visual effects for admin-created rarities. Each one plays (duel cost/power, tier) like a built-in "base" rarity.
CREATE OR REPLACE FUNCTION public._effect_base(_effect text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _effect
    WHEN 'vintage' THEN 'uncommon'
    WHEN 'tinted' THEN 'rare'
    WHEN 'cartoon' THEN 'rare'
    WHEN 'metal' THEN 'super_rare'
    WHEN 'neon' THEN 'super_rare'
    WHEN 'holo' THEN 'legendary'
    WHEN 'frost' THEN 'legendary'
    WHEN 'galaxy' THEN 'secret_legendary'
    WHEN 'common' THEN 'common' WHEN 'uncommon' THEN 'uncommon' WHEN 'rare' THEN 'rare' WHEN 'super_rare' THEN 'super_rare'
    WHEN 'legendary' THEN 'legendary' WHEN 'secret_legendary' THEN 'secret_legendary' WHEN 'secret_ultimate' THEN 'secret_ultimate'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public._validate_rarity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public._effect_base(NEW.effect) IS NULL THEN
    RAISE EXCEPTION 'Effet visuel inconnu';
  END IF;
  IF NEW.color IS NOT NULL AND NEW.color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Couleur invalide';
  END IF;
  IF length(btrim(NEW.label)) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Nom de rareté : 1 à 30 caractères'; END IF;
  IF length(btrim(NEW.short_label)) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Sigle : 1 à 4 caractères'; END IF;
  RETURN NEW;
END $$;

-- Built-in rarity a key plays like (built-ins map to themselves, style effects to their base).
CREATE OR REPLACE FUNCTION public._rarity_fx(_key text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public._effect_base((SELECT effect FROM public.rarities WHERE key = _key)), _key)
$$;

CREATE OR REPLACE FUNCTION public.admin_create_rarity(_label text, _short text, _effect text, _color text, _after_key text, _duplicate_coins integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text;
  after_rank numeric;
  next_rank numeric;
  fx_tier integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT rank INTO after_rank FROM public.rarities WHERE key = _after_key;
  IF after_rank IS NULL THEN RAISE EXCEPTION 'Rareté de référence introuvable'; END IF;
  SELECT min(rank) INTO next_rank FROM public.rarities WHERE rank > after_rank;
  SELECT tier INTO fx_tier FROM public.rarities WHERE key = public._effect_base(_effect) AND builtin;
  IF fx_tier IS NULL THEN RAISE EXCEPTION 'Effet visuel inconnu'; END IF;
  IF _duplicate_coins IS NULL OR _duplicate_coins < 0 OR _duplicate_coins > 100000 THEN RAISE EXCEPTION 'Pièces par doublon : 0 à 100 000'; END IF;
  k := 'custom_' || substr(md5(gen_random_uuid()::text), 1, 10);
  INSERT INTO public.rarities (key, label, short_label, tier, duplicate_coins, effect, color, builtin, rank)
  VALUES (k, btrim(_label), upper(btrim(_short)), fx_tier, _duplicate_coins, _effect, nullif(btrim(coalesce(_color, '')), ''), false,
    CASE WHEN next_rank IS NULL THEN after_rank + 1 ELSE (after_rank + next_rank) / 2 END);
  RETURN k;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer) TO authenticated;
-- Rarities can mix several visual effects: `effect` stays the main one (frame, gameplay), `extra_effects` are drawn on top, in order.
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS extra_effects text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public._validate_rarity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e text;
BEGIN
  IF public._effect_base(NEW.effect) IS NULL THEN
    RAISE EXCEPTION 'Effet visuel inconnu';
  END IF;
  NEW.extra_effects := coalesce(NEW.extra_effects, '{}');
  IF cardinality(NEW.extra_effects) > 14 THEN RAISE EXCEPTION 'Trop d''effets'; END IF;
  IF NEW.effect = 'common' AND cardinality(NEW.extra_effects) > 0 THEN RAISE EXCEPTION 'L''effet Simple ne se mélange pas'; END IF;
  FOREACH e IN ARRAY NEW.extra_effects LOOP
    IF public._effect_base(e) IS NULL THEN RAISE EXCEPTION 'Effet visuel inconnu'; END IF;
    IF e = 'common' THEN RAISE EXCEPTION 'L''effet Simple ne se mélange pas'; END IF;
    IF e = NEW.effect THEN RAISE EXCEPTION 'Effet choisi deux fois'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM unnest(NEW.extra_effects) x) <> cardinality(NEW.extra_effects) THEN
    RAISE EXCEPTION 'Effet choisi deux fois';
  END IF;
  IF NEW.color IS NOT NULL AND NEW.color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Couleur invalide';
  END IF;
  IF length(btrim(NEW.label)) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Nom de rareté : 1 à 30 caractères'; END IF;
  IF length(btrim(NEW.short_label)) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Sigle : 1 à 4 caractères'; END IF;
  RETURN NEW;
END $$;

DROP FUNCTION IF EXISTS public.admin_create_rarity(text, text, text, text, text, integer);
CREATE FUNCTION public.admin_create_rarity(_label text, _short text, _effect text, _color text, _after_key text, _duplicate_coins integer, _extra_effects text[] DEFAULT '{}')
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
  INSERT INTO public.rarities (key, label, short_label, tier, duplicate_coins, effect, extra_effects, color, builtin, rank)
  VALUES (k, btrim(_label), upper(btrim(_short)), fx_tier, _duplicate_coins, _effect, coalesce(_extra_effects, '{}'), nullif(btrim(coalesce(_color, '')), ''), false,
    CASE WHEN next_rank IS NULL THEN after_rank + 1 ELSE (after_rank + next_rank) / 2 END);
  RETURN k;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer, text[]) TO authenticated;

-- _extra_effects NULL keeps the current extra effects (older callers).
DROP FUNCTION IF EXISTS public.admin_update_rarity(text, text, text, text, text, integer);
CREATE FUNCTION public.admin_update_rarity(_key text, _label text, _short text, _effect text, _color text, _duplicate_coins integer, _extra_effects text[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rarities%rowtype;
  fx_tier integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT * INTO r FROM public.rarities WHERE key = _key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rareté introuvable'; END IF;
  SELECT tier INTO fx_tier FROM public.rarities WHERE key = public._effect_base(_effect) AND builtin;
  IF fx_tier IS NULL THEN RAISE EXCEPTION 'Effet visuel inconnu'; END IF;
  IF _duplicate_coins IS NULL OR _duplicate_coins < 0 OR _duplicate_coins > 100000 THEN RAISE EXCEPTION 'Pièces par doublon : 0 à 100 000'; END IF;
  UPDATE public.rarities SET
    label = btrim(_label),
    short_label = upper(btrim(_short)),
    effect = _effect,
    extra_effects = coalesce(_extra_effects, r.extra_effects),
    color = nullif(btrim(coalesce(_color, '')), ''),
    duplicate_coins = _duplicate_coins,
    tier = CASE WHEN r.builtin THEN r.tier ELSE fx_tier END
  WHERE key = _key;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_rarity(text, text, text, text, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_rarity(text, text, text, text, text, integer, text[]) TO authenticated;
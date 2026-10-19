-- Admin-created rarities: each one borrows the visual effect of a built-in rarity (effect) and an optional tint (color).
-- tier now means "visual intensity" (the effect's tier) and may repeat; rank orders rarities from least to most rare.
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS effect text NOT NULL DEFAULT 'common';
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS builtin boolean NOT NULL DEFAULT false;
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS rank numeric;
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.rarities SET effect = key, builtin = true, rank = tier
WHERE key IN ('common','uncommon','rare','super_rare','legendary','secret_legendary','secret_ultimate');
UPDATE public.rarities SET rank = tier WHERE rank IS NULL;
ALTER TABLE public.rarities ALTER COLUMN rank SET DEFAULT 100;
ALTER TABLE public.rarities ALTER COLUMN rank SET NOT NULL;
ALTER TABLE public.rarities DROP CONSTRAINT IF EXISTS rarities_tier_key;

GRANT SELECT ON public.rarities TO anon, authenticated;
GRANT ALL ON public.rarities TO service_role;

CREATE OR REPLACE FUNCTION public._validate_rarity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.effect NOT IN ('common','uncommon','rare','super_rare','legendary','secret_legendary','secret_ultimate') THEN
    RAISE EXCEPTION 'Effet visuel inconnu';
  END IF;
  IF NEW.color IS NOT NULL AND NEW.color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Couleur invalide';
  END IF;
  IF length(btrim(NEW.label)) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Nom de rareté : 1 à 30 caractères'; END IF;
  IF length(btrim(NEW.short_label)) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Sigle : 1 à 4 caractères'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rarities_validate ON public.rarities;
CREATE TRIGGER rarities_validate BEFORE INSERT OR UPDATE ON public.rarities FOR EACH ROW EXECUTE FUNCTION public._validate_rarity();

-- Visual effect of a rarity key (built-ins map to themselves).
CREATE OR REPLACE FUNCTION public._rarity_fx(_key text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT effect FROM public.rarities WHERE key = _key), _key)
$$;

CREATE OR REPLACE FUNCTION public._duel_cost(_rarity text)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE public._rarity_fx(_rarity) WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 WHEN 'super_rare' THEN 4
    WHEN 'legendary' THEN 6 WHEN 'secret_legendary' THEN 8 ELSE 99 END
$$;

CREATE OR REPLACE FUNCTION public._duel_power(_pos text, _rarity text, _version text, _rating integer, _theme text)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT _rating
    + CASE public._rarity_fx(_rarity) WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2 WHEN 'super_rare' THEN 3 WHEN 'legendary' THEN 4 WHEN 'secret_legendary' THEN 5 ELSE 0 END
    + CASE WHEN _version IN ('alt', 'shiny') THEN 2 ELSE 0 END
    + CASE
        WHEN upper(_pos) = 'CLUB' THEN 2
        WHEN _theme = 'libre' THEN 0
        WHEN _theme = 'gardien' THEN CASE WHEN upper(_pos) = 'G' THEN 6 ELSE -6 END
        WHEN upper(_pos) = 'G' THEN -6
        WHEN _theme = 'attaque' AND upper(_pos) IN ('BU', 'AD', 'AG', 'MOC') THEN 6
        WHEN _theme = 'milieu' AND upper(_pos) IN ('MC', 'MDC', 'MOC') THEN 6
        WHEN _theme = 'defense' AND upper(_pos) IN ('DC', 'DD', 'DG', 'MDC') THEN 6
        ELSE 0 END
$$;

-- Create a rarity placed just after _after_key in the rarity order.
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
  SELECT tier INTO fx_tier FROM public.rarities WHERE key = _effect AND builtin;
  IF fx_tier IS NULL THEN RAISE EXCEPTION 'Effet visuel inconnu'; END IF;
  IF _duplicate_coins IS NULL OR _duplicate_coins < 0 OR _duplicate_coins > 100000 THEN RAISE EXCEPTION 'Pièces par doublon : 0 à 100 000'; END IF;
  k := 'custom_' || substr(md5(gen_random_uuid()::text), 1, 10);
  INSERT INTO public.rarities (key, label, short_label, tier, duplicate_coins, effect, color, builtin, rank)
  VALUES (k, btrim(_label), upper(btrim(_short)), fx_tier, _duplicate_coins, _effect, nullif(btrim(coalesce(_color, '')), ''), false,
    CASE WHEN next_rank IS NULL THEN after_rank + 1 ELSE (after_rank + next_rank) / 2 END);
  RETURN k;
END $$;

-- Delete an admin-created rarity; its cards (and challenges) move to _move_to, and packs stop drawing it.
CREATE OR REPLACE FUNCTION public.admin_delete_rarity(_key text, _move_to text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  moved integer;
  b boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT builtin INTO b FROM public.rarities WHERE key = _key;
  IF b IS NULL THEN RAISE EXCEPTION 'Rareté introuvable'; END IF;
  IF b THEN RAISE EXCEPTION 'Les 7 raretés de base ne peuvent pas être supprimées'; END IF;
  IF _move_to IS NULL OR _move_to = _key OR NOT EXISTS (SELECT 1 FROM public.rarities WHERE key = _move_to) THEN
    RAISE EXCEPTION 'Choisis la rareté qui recevra ses cartes';
  END IF;
  UPDATE public.cards SET rarity = _move_to WHERE rarity = _key;
  GET DIAGNOSTICS moved = ROW_COUNT;
  UPDATE public.challenges SET rarity = _move_to, active = false WHERE rarity = _key;
  UPDATE public.pack_types SET slot_rates = slot_rates - _key WHERE slot_rates ? _key;
  DELETE FROM public.rarities WHERE key = _key;
  RETURN moved;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_rarity(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_rarity(text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_rarity(text, text) TO authenticated;
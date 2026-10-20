-- 8 more visual looks for rarities (Arrachée, Marbre, Lave, Électrique, Aquarelle, Verre brisé, Fumée, Carbone), each playing like a built-in base rarity.
CREATE OR REPLACE FUNCTION public._effect_base(_effect text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _effect
    WHEN 'vintage' THEN 'uncommon'
    WHEN 'watercolor' THEN 'uncommon'
    WHEN 'tinted' THEN 'rare'
    WHEN 'cartoon' THEN 'rare'
    WHEN 'torn' THEN 'rare'
    WHEN 'smoke' THEN 'rare'
    WHEN 'metal' THEN 'super_rare'
    WHEN 'neon' THEN 'super_rare'
    WHEN 'marble' THEN 'super_rare'
    WHEN 'electric' THEN 'super_rare'
    WHEN 'carbon' THEN 'super_rare'
    WHEN 'holo' THEN 'legendary'
    WHEN 'frost' THEN 'legendary'
    WHEN 'lava' THEN 'legendary'
    WHEN 'shattered' THEN 'legendary'
    WHEN 'galaxy' THEN 'secret_legendary'
    WHEN 'common' THEN 'common' WHEN 'uncommon' THEN 'uncommon' WHEN 'rare' THEN 'rare' WHEN 'super_rare' THEN 'super_rare'
    WHEN 'legendary' THEN 'legendary' WHEN 'secret_legendary' THEN 'secret_legendary' WHEN 'secret_ultimate' THEN 'secret_ultimate'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public._validate_rarity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e text;
BEGIN
  IF public._effect_base(NEW.effect) IS NULL THEN
    RAISE EXCEPTION 'Effet visuel inconnu';
  END IF;
  NEW.extra_effects := coalesce(NEW.extra_effects, '{}');
  IF cardinality(NEW.extra_effects) > 30 THEN RAISE EXCEPTION 'Trop d''effets'; END IF;
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
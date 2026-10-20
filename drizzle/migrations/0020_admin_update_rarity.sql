-- Built-in rarities keep playing as themselves whatever look the admin gives them; created rarities play like their effect's base.
CREATE OR REPLACE FUNCTION public._rarity_fx(_key text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT CASE WHEN r.builtin THEN r.key ELSE public._effect_base(r.effect) END FROM public.rarities r WHERE r.key = _key),
    _key)
$$;

-- Edit a rarity's name, sigle, visual effect, tint and duplicate coins. Built-ins keep their tier (gameplay); created ones follow the effect.
CREATE OR REPLACE FUNCTION public.admin_update_rarity(_key text, _label text, _short text, _effect text, _color text, _duplicate_coins integer)
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
    color = nullif(btrim(coalesce(_color, '')), ''),
    duplicate_coins = _duplicate_coins,
    tier = CASE WHEN r.builtin THEN r.tier ELSE fx_tier END
  WHERE key = _key;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_update_rarity(text, text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_rarity(text, text, text, text, text, integer) TO authenticated;
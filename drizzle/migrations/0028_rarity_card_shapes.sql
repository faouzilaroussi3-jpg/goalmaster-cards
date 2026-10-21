-- Card shape per rarity (a look only, mixed with its effects): shown in the collection and when packs are opened.
ALTER TABLE public.rarities ADD COLUMN IF NOT EXISTS shape text NOT NULL DEFAULT 'standard';
ALTER TABLE public.rarities ADD CONSTRAINT rarities_shape_check
  CHECK (shape IN ('standard', 'wanted', 'torn', 'round', 'rounded', 'shield', 'hexagon', 'ticket', 'stamp', 'polaroid', 'diamond', 'arch'));

CREATE OR REPLACE FUNCTION public.admin_set_rarity_shape(_key text, _shape text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux admins'; END IF;
  UPDATE public.rarities SET shape = _shape WHERE key = _key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rareté introuvable'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_rarity_shape(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_rarity_shape(text, text) TO authenticated;

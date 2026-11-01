CREATE TABLE public.trophy_designs (
  kind text PRIMARY KEY CHECK (kind IN ('ballon', 'rarest_card', 'most_wins')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 40),
  inscription text NOT NULL DEFAULT '' CHECK (char_length(inscription) <= 24),
  metal text NOT NULL CHECK (metal ~ '^#[0-9a-fA-F]{6}$'),
  base text NOT NULL CHECK (base ~ '^#[0-9a-fA-F]{6}$'),
  gem text NOT NULL CHECK (gem ~ '^#[0-9a-fA-F]{6}$'),
  accent text NOT NULL CHECK (accent ~ '^#[0-9a-fA-F]{6}$'),
  finish text NOT NULL DEFAULT 'poli' CHECK (finish IN ('poli', 'satine', 'brosse')),
  diamonds boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.trophy_designs TO authenticated;
GRANT ALL ON public.trophy_designs TO service_role;

ALTER TABLE public.trophy_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trophy designs are readable by players"
  ON public.trophy_designs FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.admin_save_trophy_design(
  _kind text, _name text, _inscription text, _metal text, _base text, _gem text, _accent text, _finish text, _diamonds boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n text := btrim(coalesce(_name, ''));
  _i text := upper(btrim(coalesce(_inscription, '')));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _kind NOT IN ('ballon', 'rarest_card', 'most_wins') THEN RAISE EXCEPTION 'Trophée inconnu'; END IF;
  IF char_length(_n) < 3 OR char_length(_n) > 40 THEN RAISE EXCEPTION 'Le nom doit faire entre 3 et 40 caractères'; END IF;
  IF char_length(_i) > 24 THEN RAISE EXCEPTION 'L''inscription fait 24 caractères maximum'; END IF;
  IF NOT (coalesce(_metal, '') ~ '^#[0-9a-fA-F]{6}$' AND coalesce(_base, '') ~ '^#[0-9a-fA-F]{6}$'
          AND coalesce(_gem, '') ~ '^#[0-9a-fA-F]{6}$' AND coalesce(_accent, '') ~ '^#[0-9a-fA-F]{6}$') THEN
    RAISE EXCEPTION 'Couleur invalide';
  END IF;
  IF coalesce(_finish, '') NOT IN ('poli', 'satine', 'brosse') THEN RAISE EXCEPTION 'Finition invalide'; END IF;

  INSERT INTO public.trophy_designs (kind, name, inscription, metal, base, gem, accent, finish, diamonds, updated_at, updated_by)
  VALUES (_kind, _n, _i, lower(_metal), lower(_base), lower(_gem), lower(_accent), _finish, coalesce(_diamonds, false), now(), auth.uid())
  ON CONFLICT (kind) DO UPDATE SET
    name = EXCLUDED.name, inscription = EXCLUDED.inscription, metal = EXCLUDED.metal, base = EXCLUDED.base,
    gem = EXCLUDED.gem, accent = EXCLUDED.accent, finish = EXCLUDED.finish, diamonds = EXCLUDED.diamonds,
    updated_at = now(), updated_by = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_save_trophy_design(text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_trophy_design(text, text, text, text, text, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_trophy_design(_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  DELETE FROM public.trophy_designs WHERE kind = _kind;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_reset_trophy_design(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_trophy_design(text) TO authenticated;
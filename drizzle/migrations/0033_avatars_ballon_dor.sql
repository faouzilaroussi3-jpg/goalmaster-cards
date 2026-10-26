-- Player 3D avatars: looks only, written solely by save_avatar (kits limited to clubs pulled from packs).
CREATE TABLE public.avatars (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  skin text NOT NULL DEFAULT '#c68642',
  hair text NOT NULL DEFAULT 'short',
  hair_color text NOT NULL DEFAULT '#1c1410',
  shoes text NOT NULL DEFAULT 'classic',
  shoe_color text NOT NULL DEFAULT '#ff2d87',
  kit_club text,
  shirt_name text NOT NULL DEFAULT '',
  shirt_number integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.avatars TO authenticated;
GRANT ALL ON public.avatars TO service_role;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avatars visible to signed-in players" ON public.avatars FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public._kit_clubs(_uid uuid)
RETURNS TABLE(club text, pulls integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r->>'club', count(*)::int
  FROM public.pack_openings po
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(po.results) = 'array' THEN po.results ELSE '[]'::jsonb END) r
  WHERE po.user_id = _uid AND coalesce(r->>'club', '') <> ''
  GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.get_my_kit_clubs()
RETURNS TABLE(club text, pulls integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.club, k.pulls FROM public._kit_clubs(auth.uid()) k WHERE auth.uid() IS NOT NULL ORDER BY k.pulls DESC, k.club
$$;

CREATE OR REPLACE FUNCTION public.save_avatar(
  _skin text, _hair text, _hair_color text, _shoes text, _shoe_color text,
  _kit_club text, _shirt_name text, _shirt_number integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF _skin !~ '^#[0-9a-fA-F]{6}$' OR _hair_color !~ '^#[0-9a-fA-F]{6}$' OR _shoe_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Couleur invalide';
  END IF;
  IF _hair NOT IN ('short', 'buzz', 'curly', 'afro', 'long', 'mohawk', 'bun', 'dreads', 'bald') THEN RAISE EXCEPTION 'Coiffure inconnue'; END IF;
  IF _shoes NOT IN ('classic', 'speed', 'high') THEN RAISE EXCEPTION 'Chaussures inconnues'; END IF;
  IF _shirt_number IS NULL OR _shirt_number < 1 OR _shirt_number > 99 THEN RAISE EXCEPTION 'Numéro entre 1 et 99'; END IF;
  _shirt_name := upper(btrim(coalesce(_shirt_name, '')));
  IF char_length(_shirt_name) > 12 OR _shirt_name !~ '^[A-ZÀ-ÖØ-Þ .''-]*$' THEN RAISE EXCEPTION 'Nom au dos : 12 lettres maximum'; END IF;
  IF _kit_club IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public._kit_clubs(uid) k WHERE k.club = _kit_club) THEN
    RAISE EXCEPTION 'Tire une carte de ce club dans un pack pour débloquer son maillot';
  END IF;
  INSERT INTO public.avatars (user_id, skin, hair, hair_color, shoes, shoe_color, kit_club, shirt_name, shirt_number, updated_at)
  VALUES (uid, lower(_skin), _hair, lower(_hair_color), _shoes, lower(_shoe_color), _kit_club, _shirt_name, _shirt_number, now())
  ON CONFLICT (user_id) DO UPDATE SET skin = EXCLUDED.skin, hair = EXCLUDED.hair, hair_color = EXCLUDED.hair_color,
    shoes = EXCLUDED.shoes, shoe_color = EXCLUDED.shoe_color, kit_club = EXCLUDED.kit_club,
    shirt_name = EXCLUDED.shirt_name, shirt_number = EXCLUDED.shirt_number, updated_at = now();
END $$;

-- Weekly Ballon d'Or ceremonies: scheduled, started and awarded by the admin only.
CREATE TABLE public.ballon_dor_ceremonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  reward_coins integer NOT NULL DEFAULT 1000 CHECK (reward_coins BETWEEN 0 AND 1000000),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'cancelled')),
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  winner_name text,
  started_at timestamptz,
  awarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ballon_dor_ceremonies TO authenticated;
GRANT ALL ON public.ballon_dor_ceremonies TO service_role;
ALTER TABLE public.ballon_dor_ceremonies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ceremonies visible to signed-in players" ON public.ballon_dor_ceremonies FOR SELECT TO authenticated USING (true);
CREATE UNIQUE INDEX ballon_dor_one_live ON public.ballon_dor_ceremonies ((true)) WHERE status = 'live';
CREATE INDEX ballon_dor_winner_idx ON public.ballon_dor_ceremonies (winner_id) WHERE status = 'finished';
ALTER PUBLICATION supabase_realtime ADD TABLE public.ballon_dor_ceremonies;

CREATE OR REPLACE FUNCTION public.admin_schedule_ballon_dor(_title text, _at timestamptz, _coins integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _at IS NULL THEN RAISE EXCEPTION 'Date obligatoire'; END IF;
  IF _coins IS NULL OR _coins < 0 OR _coins > 1000000 THEN RAISE EXCEPTION 'Récompense entre 0 et 1 000 000 pièces'; END IF;
  INSERT INTO public.ballon_dor_ceremonies (title, scheduled_at, reward_coins)
  VALUES (coalesce(nullif(btrim(left(_title, 80)), ''), 'Ballon d''Or de la semaine'), _at, _coins)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_start_ballon_dor(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF EXISTS (SELECT 1 FROM public.ballon_dor_ceremonies WHERE status = 'live' AND id <> _id) THEN
    RAISE EXCEPTION 'Une autre cérémonie est déjà en cours';
  END IF;
  UPDATE public.ballon_dor_ceremonies SET status = 'live', started_at = now() WHERE id = _id AND status = 'scheduled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cette cérémonie ne peut pas être lancée'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_award_ballon_dor(_id uuid, _winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; wname text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT * INTO c FROM public.ballon_dor_ceremonies WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'live' THEN RAISE EXCEPTION 'Lance la cérémonie avant de désigner le gagnant'; END IF;
  SELECT username INTO wname FROM public.profiles WHERE id = _winner;
  IF wname IS NULL THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
  UPDATE public.profiles SET coins = coins + c.reward_coins WHERE id = _winner;
  UPDATE public.ballon_dor_ceremonies
  SET status = 'finished', winner_id = _winner, winner_name = wname, awarded_at = now()
  WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_ballon_dor(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  UPDATE public.ballon_dor_ceremonies SET status = 'cancelled' WHERE id = _id AND status IN ('scheduled', 'live');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cette cérémonie est déjà terminée'; END IF;
END $$;
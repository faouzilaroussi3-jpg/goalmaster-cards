-- Admin pulls (test openings) never appear in the public live feed.
CREATE OR REPLACE FUNCTION public._record_big_pulls() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN RETURN NEW; END IF;
  IF coalesce(jsonb_array_length(OLD.results), 0) = 0 AND coalesce(jsonb_array_length(NEW.results), 0) > 0 THEN
    INSERT INTO public.big_pulls (opening_id, user_id, card_id, name, club, nationality, pos, rating, rarity, version, image_url, pack_key, pulled_at)
    SELECT NEW.id, NEW.user_id, (e->>'card_id')::uuid, e->>'name', e->>'club', e->>'nationality', e->>'pos', (e->>'rating')::int,
      e->>'rarity', coalesce(e->>'version', 'normal'), e->>'image_url', pt.key, now()
    FROM jsonb_array_elements(NEW.results) e
    LEFT JOIN public.pack_types pt ON pt.id = NEW.pack_type_id
    WHERE coalesce((e->>'tier')::int, 0) >= 5 AND e->>'rarity' <> 'secret_ultimate';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public._record_big_pulls() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_big_pulls(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, card_id uuid, name text, club text, nationality text, pos text, rating integer,
  rarity text, version text, image_url text, pack_key text, pulled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, p.username, b.card_id, b.name, b.club, b.nationality, b.pos, b.rating, b.rarity, b.version, b.image_url, b.pack_key, b.pulled_at
  FROM public.big_pulls b LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = b.user_id AND r.role = 'admin')
  ORDER BY b.pulled_at DESC
  LIMIT least(greatest(_limit, 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.get_big_pulls(integer) TO anon, authenticated;

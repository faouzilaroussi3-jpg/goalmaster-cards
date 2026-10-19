CREATE TABLE public.big_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id uuid REFERENCES public.pack_openings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  card_id uuid NOT NULL,
  name text NOT NULL,
  club text NOT NULL,
  nationality text NOT NULL,
  pos text NOT NULL,
  rating integer NOT NULL,
  rarity text NOT NULL,
  version text NOT NULL DEFAULT 'normal',
  image_url text,
  pack_key text,
  pulled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX big_pulls_pulled_at_idx ON public.big_pulls(pulled_at DESC);
GRANT SELECT ON public.big_pulls TO anon, authenticated;
GRANT ALL ON public.big_pulls TO service_role;
ALTER TABLE public.big_pulls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "big pulls readable" ON public.big_pulls FOR SELECT TO anon, authenticated USING (true);

-- Every Légendaire-or-better pulled from a pack (Secrète Ultime excluded so the tier stays secret).
CREATE OR REPLACE FUNCTION public._record_big_pulls() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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

CREATE TRIGGER pack_openings_big_pulls AFTER UPDATE OF results ON public.pack_openings
  FOR EACH ROW EXECUTE FUNCTION public._record_big_pulls();

INSERT INTO public.big_pulls (opening_id, user_id, card_id, name, club, nationality, pos, rating, rarity, version, image_url, pack_key, pulled_at)
SELECT po.id, po.user_id, (e->>'card_id')::uuid, e->>'name', e->>'club', e->>'nationality', e->>'pos', (e->>'rating')::int,
  e->>'rarity', coalesce(e->>'version', 'normal'), e->>'image_url', pt.key, po.created_at
FROM public.pack_openings po
CROSS JOIN LATERAL jsonb_array_elements(po.results) e
LEFT JOIN public.pack_types pt ON pt.id = po.pack_type_id
WHERE coalesce((e->>'tier')::int, 0) >= 5 AND e->>'rarity' <> 'secret_ultimate';

CREATE OR REPLACE FUNCTION public.get_big_pulls(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, card_id uuid, name text, club text, nationality text, pos text, rating integer,
  rarity text, version text, image_url text, pack_key text, pulled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, p.username, b.card_id, b.name, b.club, b.nationality, b.pos, b.rating, b.rarity, b.version, b.image_url, b.pack_key, b.pulled_at
  FROM public.big_pulls b LEFT JOIN public.profiles p ON p.id = b.user_id
  ORDER BY b.pulled_at DESC
  LIMIT least(greatest(_limit, 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.get_big_pulls(integer) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.big_pulls;
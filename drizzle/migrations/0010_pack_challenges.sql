CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  metric text NOT NULL DEFAULT 'rarity' CHECK (metric IN ('total', 'rarity', 'version')),
  rarity text REFERENCES public.rarities(key),
  version text,
  target integer NOT NULL CHECK (target > 0),
  reward_coins integer NOT NULL CHECK (reward_coins >= 0),
  secret boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable unless secret" ON public.challenges FOR SELECT TO authenticated
  USING (NOT secret OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin manage challenges" ON public.challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.challenge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  reward_coins integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);
GRANT SELECT ON public.challenge_claims TO authenticated;
GRANT ALL ON public.challenge_claims TO service_role;
ALTER TABLE public.challenge_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims readable" ON public.challenge_claims FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS pack_openings_user_idx ON public.pack_openings(user_id);

-- Cards a player has pulled from packs (every copy, duplicates included), matching a challenge metric.
CREATE OR REPLACE FUNCTION public._challenge_progress(_uid uuid, _metric text, _rarity text, _version text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
  FROM public.pack_openings po
  CROSS JOIN LATERAL jsonb_array_elements(po.results) e
  WHERE po.user_id = _uid
    AND CASE _metric
      WHEN 'total' THEN true
      WHEN 'rarity' THEN e->>'rarity' = _rarity
      WHEN 'version' THEN coalesce(e->>'version', 'normal') = _version
      ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public._challenge_progress(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_challenges()
RETURNS TABLE(challenge_id uuid, key text, title text, metric text, rarity text, version text, target integer,
  reward_coins integer, secret boolean, sort_order integer, progress integer, claimed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.key, c.title, c.metric, c.rarity, c.version, c.target, c.reward_coins, c.secret, c.sort_order,
    p.n,
    EXISTS (SELECT 1 FROM public.challenge_claims cc WHERE cc.user_id = auth.uid() AND cc.challenge_id = c.id)
  FROM public.challenges c
  CROSS JOIN LATERAL (SELECT public._challenge_progress(auth.uid(), c.metric, c.rarity, c.version) AS n) p
  WHERE auth.uid() IS NOT NULL AND c.active
    AND (NOT c.secret OR p.n > 0 OR public.has_role(auth.uid(), 'admin'::app_role))
  ORDER BY c.sort_order, c.target
$$;

-- Returns the coins credited, 0 when the challenge is not completed or already claimed.
CREATE OR REPLACE FUNCTION public._claim_challenge(_uid uuid, _cid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.challenges%rowtype;
  n integer;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _cid AND active;
  IF NOT FOUND THEN RETURN 0; END IF;
  n := public._challenge_progress(_uid, c.metric, c.rarity, c.version);
  IF n < c.target THEN RETURN 0; END IF;
  INSERT INTO public.challenge_claims (user_id, challenge_id, reward_coins)
    VALUES (_uid, _cid, c.reward_coins) ON CONFLICT (user_id, challenge_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  UPDATE public.profiles SET coins = coins + c.reward_coins WHERE id = _uid;
  RETURN c.reward_coins;
END $$;
REVOKE EXECUTE ON FUNCTION public._claim_challenge(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_challenge(_challenge_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  got integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  got := public._claim_challenge(uid, _challenge_id);
  IF got = 0 AND NOT EXISTS (SELECT 1 FROM public.challenge_claims WHERE user_id = uid AND challenge_id = _challenge_id AND reward_coins = 0) THEN
    IF EXISTS (SELECT 1 FROM public.challenge_claims WHERE user_id = uid AND challenge_id = _challenge_id) THEN
      RAISE EXCEPTION 'Récompense déjà récupérée';
    END IF;
    RAISE EXCEPTION 'Défi pas encore accompli';
  END IF;
  RETURN got;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_challenge(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_all_challenges()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  got integer;
  total integer := 0;
  cnt integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  FOR r IN SELECT c.id FROM public.challenges c WHERE c.active
    AND NOT EXISTS (SELECT 1 FROM public.challenge_claims cc WHERE cc.user_id = uid AND cc.challenge_id = c.id)
  LOOP
    got := public._claim_challenge(uid, r.id);
    IF got > 0 THEN total := total + got; cnt := cnt + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('claimed', cnt, 'coins', total);
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_all_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_all_challenges() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_challenges() TO authenticated;

INSERT INTO public.challenges (key, title, metric, rarity, version, target, reward_coins, secret, sort_order) VALUES
  ('total_25', 'Premiers pas', 'total', NULL, NULL, 25, 100, false, 10),
  ('total_100', 'Collectionneur', 'total', NULL, NULL, 100, 300, false, 10),
  ('total_250', 'Passionné', 'total', NULL, NULL, 250, 600, false, 10),
  ('total_500', 'Accro du pack', 'total', NULL, NULL, 500, 1200, false, 10),
  ('total_1000', 'Maître collectionneur', 'total', NULL, NULL, 1000, 2500, false, 10),
  ('common_10', 'Recrue', 'rarity', 'common', NULL, 10, 50, false, 20),
  ('common_50', 'Remplaçant', 'rarity', 'common', NULL, 50, 150, false, 20),
  ('common_150', 'Titulaire', 'rarity', 'common', NULL, 150, 400, false, 20),
  ('common_400', 'Pilier du vestiaire', 'rarity', 'common', NULL, 400, 1000, false, 20),
  ('uncommon_10', 'Espoir', 'rarity', 'uncommon', NULL, 10, 75, false, 30),
  ('uncommon_30', 'Révélation', 'rarity', 'uncommon', NULL, 30, 200, false, 30),
  ('uncommon_100', 'Joueur confirmé', 'rarity', 'uncommon', NULL, 100, 500, false, 30),
  ('uncommon_250', 'Cadre de l''équipe', 'rarity', 'uncommon', NULL, 250, 1200, false, 30),
  ('rare_5', 'Talent', 'rarity', 'rare', NULL, 5, 100, false, 40),
  ('rare_20', 'International', 'rarity', 'rare', NULL, 20, 300, false, 40),
  ('rare_60', 'Joueur clé', 'rarity', 'rare', NULL, 60, 700, false, 40),
  ('rare_150', 'Star du championnat', 'rarity', 'rare', NULL, 150, 1500, false, 40),
  ('super_rare_3', 'Pépite', 'rarity', 'super_rare', NULL, 3, 150, false, 50),
  ('super_rare_10', 'Crack', 'rarity', 'super_rare', NULL, 10, 400, false, 50),
  ('super_rare_30', 'Top player', 'rarity', 'super_rare', NULL, 30, 1000, false, 50),
  ('super_rare_75', 'Ballon d''or en vue', 'rarity', 'super_rare', NULL, 75, 2500, false, 50),
  ('legendary_1', 'Première légende', 'rarity', 'legendary', NULL, 1, 300, false, 60),
  ('legendary_5', 'Panthéon', 'rarity', 'legendary', NULL, 5, 1000, false, 60),
  ('legendary_15', 'Galerie des légendes', 'rarity', 'legendary', NULL, 15, 2500, false, 60),
  ('legendary_40', 'Immortel', 'rarity', 'legendary', NULL, 40, 6000, false, 60),
  ('alt_1', 'Édition spéciale', 'version', NULL, 'alt', 1, 500, false, 70),
  ('alt_5', 'Collection arc-en-ciel', 'version', NULL, 'alt', 5, 2000, false, 70),
  ('secret_legendary_1', 'Éclat de diamant', 'rarity', 'secret_legendary', NULL, 1, 800, false, 80),
  ('secret_legendary_3', 'Joaillier', 'rarity', 'secret_legendary', NULL, 3, 2000, false, 80),
  ('secret_legendary_10', 'Trésor caché', 'rarity', 'secret_legendary', NULL, 10, 6000, false, 80),
  ('shiny_1', 'Néon', 'version', NULL, 'shiny', 1, 1500, false, 90),
  ('shiny_3', 'Néon absolu', 'version', NULL, 'shiny', 3, 5000, false, 90),
  ('secret_ultimate_1', 'Le feu sacré', 'rarity', 'secret_ultimate', NULL, 1, 5000, true, 100),
  ('secret_ultimate_3', 'Maître des dragons', 'rarity', 'secret_ultimate', NULL, 3, 15000, true, 100);
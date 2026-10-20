CREATE TABLE public.periodic_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  period text NOT NULL CHECK (period IN ('daily', 'weekly')),
  slot integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('packs', 'cards', 'rarity', 'version', 'duels_played', 'duels_won')),
  rarity text REFERENCES public.rarities(key) ON UPDATE CASCADE ON DELETE CASCADE,
  version text,
  target integer NOT NULL CHECK (target > 0),
  reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  reward_pack_key text REFERENCES public.pack_types(key) ON UPDATE CASCADE ON DELETE CASCADE,
  reward_packs integer NOT NULL DEFAULT 0 CHECK (reward_packs >= 0 AND reward_packs <= 50),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reward_coins > 0 OR reward_packs > 0),
  CHECK (reward_packs = 0 OR reward_pack_key IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.periodic_challenges TO authenticated;
GRANT ALL ON public.periodic_challenges TO service_role;
ALTER TABLE public.periodic_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periodic challenges readable" ON public.periodic_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage periodic challenges" ON public.periodic_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.periodic_challenge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.periodic_challenges(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  reward_coins integer NOT NULL DEFAULT 0,
  reward_pack_key text,
  reward_packs integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id, period_start)
);
GRANT SELECT ON public.periodic_challenge_claims TO authenticated;
GRANT ALL ON public.periodic_challenge_claims TO service_role;
ALTER TABLE public.periodic_challenge_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own periodic claims readable" ON public.periodic_challenge_claims FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS duels_finished_idx ON public.duels (finished_at) WHERE status = 'finished';

-- Daily periods start at midnight Paris time, weekly periods on Monday midnight Paris time.
CREATE OR REPLACE FUNCTION public._period_bounds(_period text, OUT period_start timestamptz, OUT period_end timestamptz)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT date_trunc(x.u, now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris',
         (date_trunc(x.u, now() AT TIME ZONE 'Europe/Paris') + x.len) AT TIME ZONE 'Europe/Paris'
  FROM (SELECT CASE WHEN _period = 'weekly' THEN 'week' ELSE 'day' END AS u,
               CASE WHEN _period = 'weekly' THEN interval '7 days' ELSE interval '1 day' END AS len) x
$$;

-- One challenge per (period, slot), rotated deterministically each period: same picks for every player.
CREATE OR REPLACE FUNCTION public._current_periodic_challenges()
RETURNS TABLE(challenge_id uuid, period text, period_start timestamptz, period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (c.period, c.slot) c.id, c.period, b.period_start, b.period_end
  FROM public.periodic_challenges c
  CROSS JOIN LATERAL public._period_bounds(c.period) b
  WHERE c.active
  ORDER BY c.period, c.slot, md5(extract(epoch FROM b.period_start)::bigint::text || ':' || c.key)
$$;

-- Progress inside the current period. Duels ended by forfeit do not count (prevents farming with a second account).
CREATE OR REPLACE FUNCTION public._periodic_progress(_uid uuid, _metric text, _rarity text, _version text, _from timestamptz, _to timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _metric = 'packs' THEN (
      SELECT count(*)::int FROM public.pack_openings po
      WHERE po.user_id = _uid AND po.created_at >= _from AND po.created_at < _to)
    WHEN _metric IN ('cards', 'rarity', 'version') THEN (
      SELECT count(*)::int FROM public.pack_openings po
      CROSS JOIN LATERAL jsonb_array_elements(po.results) e
      WHERE po.user_id = _uid AND po.created_at >= _from AND po.created_at < _to
        AND CASE _metric
          WHEN 'cards' THEN true
          WHEN 'rarity' THEN e->>'rarity' = _rarity
          ELSE coalesce(e->>'version', 'normal') = _version END)
    WHEN _metric = 'duels_played' THEN (
      SELECT count(*)::int FROM public.duels d
      WHERE d.status = 'finished' AND NOT d.forfeit AND _uid IN (d.challenger_id, d.opponent_id)
        AND d.finished_at >= _from AND d.finished_at < _to)
    WHEN _metric = 'duels_won' THEN (
      SELECT count(*)::int FROM public.duels d
      WHERE d.status = 'finished' AND NOT d.forfeit AND d.winner_id = _uid
        AND d.finished_at >= _from AND d.finished_at < _to)
    ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.get_my_periodic_challenges()
RETURNS TABLE(challenge_id uuid, key text, period text, title text, metric text, rarity text, version text, target integer,
  reward_coins integer, reward_pack_key text, reward_pack_name text, reward_packs integer, progress integer, claimed boolean, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.key, c.period, c.title, c.metric, c.rarity, c.version, c.target,
    c.reward_coins, c.reward_pack_key, pt.name, c.reward_packs,
    public._periodic_progress(auth.uid(), c.metric, c.rarity, c.version, cur.period_start, cur.period_end),
    EXISTS (SELECT 1 FROM public.periodic_challenge_claims cc
            WHERE cc.user_id = auth.uid() AND cc.challenge_id = c.id AND cc.period_start = cur.period_start),
    cur.period_end
  FROM public._current_periodic_challenges() cur
  JOIN public.periodic_challenges c ON c.id = cur.challenge_id
  LEFT JOIN public.pack_types pt ON pt.key = c.reward_pack_key
  WHERE auth.uid() IS NOT NULL
  ORDER BY CASE c.period WHEN 'daily' THEN 0 ELSE 1 END, c.slot
$$;

-- Pays coins and packs once per player, challenge and period. Returns NULL when not completed, not current or already claimed.
CREATE OR REPLACE FUNCTION public._claim_periodic(_uid uuid, _cid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.periodic_challenges%rowtype;
  cur record;
  n integer;
  pt_id uuid;
BEGIN
  SELECT * INTO cur FROM public._current_periodic_challenges() x WHERE x.challenge_id = _cid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.periodic_challenges WHERE id = _cid;
  n := public._periodic_progress(_uid, c.metric, c.rarity, c.version, cur.period_start, cur.period_end);
  IF n < c.target THEN RETURN NULL; END IF;
  INSERT INTO public.periodic_challenge_claims (user_id, challenge_id, period_start, reward_coins, reward_pack_key, reward_packs)
    VALUES (_uid, _cid, cur.period_start, c.reward_coins, c.reward_pack_key, c.reward_packs)
    ON CONFLICT (user_id, challenge_id, period_start) DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.reward_coins > 0 THEN
    UPDATE public.profiles SET coins = least(coins::bigint + c.reward_coins, 2000000000)::integer WHERE id = _uid;
  END IF;
  IF c.reward_packs > 0 THEN
    SELECT id INTO pt_id FROM public.pack_types WHERE key = c.reward_pack_key;
    IF pt_id IS NOT NULL THEN
      PERFORM public._sync_stock(_uid, pt_id);
      UPDATE public.pack_stocks SET count = count + c.reward_packs WHERE user_id = _uid AND pack_type_id = pt_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('coins', c.reward_coins, 'packs', c.reward_packs, 'pack_key', c.reward_pack_key);
END $$;

CREATE OR REPLACE FUNCTION public.claim_periodic_challenge(_challenge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  got jsonb;
  cur record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  got := public._claim_periodic(uid, _challenge_id);
  IF got IS NOT NULL THEN RETURN got; END IF;
  SELECT * INTO cur FROM public._current_periodic_challenges() x WHERE x.challenge_id = _challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ce défi est terminé, un nouveau l''a remplacé'; END IF;
  IF EXISTS (SELECT 1 FROM public.periodic_challenge_claims
             WHERE user_id = uid AND challenge_id = _challenge_id AND period_start = cur.period_start) THEN
    RAISE EXCEPTION 'Récompense déjà récupérée';
  END IF;
  RAISE EXCEPTION 'Défi pas encore accompli';
END $$;

CREATE OR REPLACE FUNCTION public.claim_all_periodic_challenges()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  got jsonb;
  coins integer := 0;
  packs integer := 0;
  cnt integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  FOR r IN SELECT x.challenge_id FROM public._current_periodic_challenges() x LOOP
    got := public._claim_periodic(uid, r.challenge_id);
    IF got IS NOT NULL THEN
      cnt := cnt + 1;
      coins := coins + (got->>'coins')::int;
      packs := packs + (got->>'packs')::int;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('claimed', cnt, 'coins', coins, 'packs', packs);
END $$;

REVOKE EXECUTE ON FUNCTION public._period_bounds(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._current_periodic_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._periodic_progress(uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._claim_periodic(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_periodic_challenges() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_periodic_challenge(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_all_periodic_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_periodic_challenges(), public.claim_periodic_challenge(uuid),
  public.claim_all_periodic_challenges() TO authenticated;

INSERT INTO public.periodic_challenges (key, period, slot, title, metric, rarity, version, target, reward_coins, reward_pack_key, reward_packs) VALUES
  ('d_packs_3', 'daily', 1, 'Routine du jour', 'packs', NULL, NULL, 3, 100, 'classic', 1),
  ('d_packs_5', 'daily', 1, 'Journée d''ouverture', 'packs', NULL, NULL, 5, 150, 'classic', 1),
  ('d_common_10', 'daily', 2, 'Banc de touche', 'rarity', 'common', NULL, 10, 120, NULL, 0),
  ('d_rare_3', 'daily', 2, 'Œil du recruteur', 'rarity', 'rare', NULL, 3, 150, NULL, 0),
  ('d_sr_1', 'daily', 2, 'Pépite du jour', 'rarity', 'super_rare', NULL, 1, 150, 'classic', 1),
  ('d_cards_15', 'daily', 3, 'Moisson quotidienne', 'cards', NULL, NULL, 15, 100, 'classic', 1),
  ('d_duel_play_1', 'daily', 3, 'Échauffement', 'duels_played', NULL, NULL, 1, 100, 'classic', 1),
  ('d_duel_win_1', 'daily', 3, 'Victoire du jour', 'duels_won', NULL, NULL, 1, 200, NULL, 0),
  ('w_packs_20', 'weekly', 1, 'Semaine de packs', 'packs', NULL, NULL, 20, 500, 'premium', 1),
  ('w_packs_30', 'weekly', 1, 'Marathon de packs', 'packs', NULL, NULL, 30, 800, 'premium', 1),
  ('w_legendary_1', 'weekly', 2, 'Légende de la semaine', 'rarity', 'legendary', NULL, 1, 600, 'premium', 1),
  ('w_sr_5', 'weekly', 2, 'Cracks en série', 'rarity', 'super_rare', NULL, 5, 500, 'classic', 3),
  ('w_duel_win_3', 'weekly', 3, 'Tacticien', 'duels_won', NULL, NULL, 3, 600, 'classic', 2),
  ('w_duel_play_5', 'weekly', 3, 'Habitué des duels', 'duels_played', NULL, NULL, 5, 500, 'classic', 2),
  ('w_cards_100', 'weekly', 4, 'Centurion', 'cards', NULL, NULL, 100, 700, 'premium', 1),
  ('w_rare_15', 'weekly', 4, 'Chasseur de Rares', 'rarity', 'rare', NULL, 15, 500, 'classic', 3);
-- Admin-made "special" challenges: shown to every player from starts_at until ends_at, then they disappear.
ALTER TABLE public.periodic_challenges ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.periodic_challenges ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.periodic_challenges DROP CONSTRAINT IF EXISTS periodic_challenges_period_check;
ALTER TABLE public.periodic_challenges ADD CONSTRAINT periodic_challenges_period_check
  CHECK (period IN ('daily', 'weekly', 'special'));
ALTER TABLE public.periodic_challenges ADD CONSTRAINT periodic_challenges_special_window_check
  CHECK (period <> 'special' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at));
CREATE INDEX IF NOT EXISTS periodic_challenges_special_idx ON public.periodic_challenges (ends_at) WHERE period = 'special';

-- Daily/weekly rotate one challenge per slot; every live special challenge is current for its own window.
CREATE OR REPLACE FUNCTION public._current_periodic_challenges()
RETURNS TABLE(challenge_id uuid, period text, period_start timestamptz, period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.period, r.period_start, r.period_end FROM (
    SELECT DISTINCT ON (c.period, c.slot) c.id, c.period, b.period_start, b.period_end
    FROM public.periodic_challenges c
    CROSS JOIN LATERAL public._period_bounds(c.period) b
    WHERE c.active AND c.period IN ('daily', 'weekly')
    ORDER BY c.period, c.slot, md5(extract(epoch FROM b.period_start)::bigint::text || ':' || c.key)
  ) r
  UNION ALL
  SELECT c.id, c.period, c.starts_at, c.ends_at
  FROM public.periodic_challenges c
  WHERE c.active AND c.period = 'special' AND now() >= c.starts_at AND now() < c.ends_at
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
  ORDER BY CASE c.period WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 ELSE 2 END, cur.period_end, c.slot
$$;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Ce défi est terminé'; END IF;
  IF EXISTS (SELECT 1 FROM public.periodic_challenge_claims
             WHERE user_id = uid AND challenge_id = _challenge_id AND period_start = cur.period_start) THEN
    RAISE EXCEPTION 'Récompense déjà récupérée';
  END IF;
  RAISE EXCEPTION 'Défi pas encore accompli';
END $$;

-- Admin creates a special challenge that starts now and disappears after _minutes (1 hour to 90 days).
CREATE OR REPLACE FUNCTION public.admin_create_special_challenge(
  _title text, _metric text, _rarity text, _version text, _target integer,
  _reward_coins integer, _reward_pack_key text, _reward_packs integer, _minutes integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text := btrim(coalesce(_title, ''));
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF length(t) < 1 OR length(t) > 60 THEN RAISE EXCEPTION 'Le titre doit faire entre 1 et 60 caractères'; END IF;
  IF _metric NOT IN ('packs', 'cards', 'rarity', 'version', 'duels_played', 'duels_won') THEN RAISE EXCEPTION 'Objectif inconnu'; END IF;
  IF _target IS NULL OR _target < 1 OR _target > 10000 THEN RAISE EXCEPTION 'L''objectif doit être entre 1 et 10 000'; END IF;
  IF _minutes IS NULL OR _minutes < 60 OR _minutes > 129600 THEN RAISE EXCEPTION 'La durée doit être entre 1 heure et 90 jours'; END IF;
  IF coalesce(_reward_coins, 0) < 0 OR coalesce(_reward_coins, 0) > 1000000 THEN RAISE EXCEPTION 'Pièces : entre 0 et 1 000 000'; END IF;
  IF coalesce(_reward_packs, 0) < 0 OR coalesce(_reward_packs, 0) > 50 THEN RAISE EXCEPTION 'Packs : entre 0 et 50'; END IF;
  IF coalesce(_reward_coins, 0) = 0 AND coalesce(_reward_packs, 0) = 0 THEN RAISE EXCEPTION 'Mets au moins une récompense'; END IF;
  IF coalesce(_reward_packs, 0) > 0 AND NOT EXISTS (SELECT 1 FROM public.pack_types WHERE key = _reward_pack_key) THEN
    RAISE EXCEPTION 'Pack de récompense introuvable';
  END IF;
  IF _metric = 'rarity' AND (_rarity IS NULL OR _rarity = 'secret_ultimate' OR NOT EXISTS (SELECT 1 FROM public.rarities WHERE key = _rarity)) THEN
    RAISE EXCEPTION 'Choisis une rareté';
  END IF;
  IF _metric = 'version' AND coalesce(_version, '') NOT IN ('alt', 'shiny') THEN RAISE EXCEPTION 'Choisis ALT ou Shiny'; END IF;

  INSERT INTO public.periodic_challenges (key, period, slot, title, metric, rarity, version, target,
    reward_coins, reward_pack_key, reward_packs, active, starts_at, ends_at)
  VALUES ('special_' || replace(gen_random_uuid()::text, '-', ''), 'special', 0, t, _metric,
    CASE WHEN _metric = 'rarity' THEN _rarity END, CASE WHEN _metric = 'version' THEN _version END, _target,
    coalesce(_reward_coins, 0), CASE WHEN coalesce(_reward_packs, 0) > 0 THEN _reward_pack_key END, coalesce(_reward_packs, 0),
    true, now(), now() + make_interval(mins => _minutes))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Admin ends a special challenge right away (it disappears for players; past claims are kept).
CREATE OR REPLACE FUNCTION public.admin_end_special_challenge(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  UPDATE public.periodic_challenges SET ends_at = greatest(starts_at + interval '1 second', now())
  WHERE id = _challenge_id AND period = 'special' AND ends_at > now();
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_create_special_challenge(text, text, text, text, integer, integer, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_end_special_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_special_challenge(text, text, text, text, integer, integer, text, integer, integer),
  public.admin_end_special_challenge(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._current_periodic_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_periodic_challenges() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_periodic_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_periodic_challenges(), public.claim_periodic_challenge(uuid) TO authenticated;
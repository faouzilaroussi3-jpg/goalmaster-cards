-- Side trophies handed out during the Ballon d'Or ceremony, before the Ballon d'Or itself:
-- rarest card pulled from packs and most matches won over the 7 days before the award.
ALTER TABLE public.ballon_dor_ceremonies
  ADD COLUMN trophy_coins integer NOT NULL DEFAULT 500 CHECK (trophy_coins BETWEEN 0 AND 1000000);

CREATE TABLE public.ceremony_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_id uuid NOT NULL REFERENCES public.ballon_dor_ceremonies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('rarest_card', 'most_wins')),
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  winner_name text NOT NULL,
  detail text NOT NULL DEFAULT '',
  reward_coins integer NOT NULL DEFAULT 0,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ceremony_id, kind)
);
GRANT SELECT ON public.ceremony_awards TO authenticated;
GRANT ALL ON public.ceremony_awards TO service_role;
ALTER TABLE public.ceremony_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ceremony awards visible to signed-in players" ON public.ceremony_awards FOR SELECT TO authenticated USING (true);
CREATE INDEX ceremony_awards_winner_idx ON public.ceremony_awards (winner_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.ceremony_awards;

-- Best card each non-admin player pulled from packs in the window, rarest first (rank, then ALT/Shiny, then rating, then earliest).
CREATE OR REPLACE FUNCTION public._weekly_rarest_pulls(_since timestamptz, _until timestamptz, _limit integer)
RETURNS TABLE(user_id uuid, username text, card_name text, rarity text, rarity_label text, version text, rating integer, pulled_at timestamptz, rarity_rank numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT po.user_id AS uid, r.x, po.created_at,
      coalesce(ra.rank, (r.x->>'rank')::numeric, 0) AS rk, ra.label,
      coalesce(r.x->>'version', 'normal') AS ver, coalesce((r.x->>'rating')::int, 0) AS rt
    FROM public.pack_openings po
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(po.results) = 'array' THEN po.results ELSE '[]'::jsonb END) AS r(x)
    LEFT JOIN public.rarities ra ON ra.key = r.x->>'rarity'
    WHERE po.created_at >= _since AND po.created_at < _until
  ), best AS (
    SELECT DISTINCT ON (p.uid) p.uid, p.x->>'name' AS card_name, p.x->>'rarity' AS rarity,
      coalesce(p.label, p.x->>'rarity_label', p.x->>'rarity') AS rarity_label, p.ver, p.rt, p.created_at, p.rk
    FROM p
    ORDER BY p.uid, p.rk DESC, (p.ver <> 'normal') DESC, p.rt DESC, p.created_at
  )
  SELECT b.uid, pr.username, b.card_name, b.rarity, b.rarity_label, b.ver, b.rt, b.created_at, b.rk
  FROM best b JOIN public.profiles pr ON pr.id = b.uid
  WHERE NOT public.has_role(b.uid, 'admin')
  ORDER BY b.rk DESC, (b.ver <> 'normal') DESC, b.rt DESC, b.created_at
  LIMIT _limit
$$;
REVOKE EXECUTE ON FUNCTION public._weekly_rarest_pulls(timestamptz, timestamptz, integer) FROM PUBLIC, anon, authenticated;

-- Matches won (11v11 simulated + steered, against players or bots) per non-admin player in the window.
CREATE OR REPLACE FUNCTION public._weekly_match_wins(_since timestamptz, _until timestamptz, _limit integer)
RETURNS TABLE(user_id uuid, username text, wins integer, played integer, goal_diff integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH g AS (
    SELECT s.uid, m.winner_id IS NOT DISTINCT FROM s.uid AS won,
      CASE WHEN s.uid = m.home_id THEN m.home_goals - m.away_goals ELSE m.away_goals - m.home_goals END AS gd
    FROM public.matches m CROSS JOIN LATERAL (VALUES (m.home_id), (m.away_id)) AS s(uid)
    WHERE m.status = 'finished' AND m.finished_at >= _since AND m.finished_at < _until AND s.uid IS NOT NULL
    UNION ALL
    SELECT s.uid, m.winner_id IS NOT DISTINCT FROM s.uid,
      CASE WHEN s.uid = m.home_id THEN m.home_goals - m.away_goals ELSE m.away_goals - m.home_goals END
    FROM public.live_matches m CROSS JOIN LATERAL (VALUES (m.home_id), (m.away_id)) AS s(uid)
    WHERE m.status = 'finished' AND m.finished_at >= _since AND m.finished_at < _until AND s.uid IS NOT NULL
  )
  SELECT g.uid, pr.username, (count(*) FILTER (WHERE g.won))::int, count(*)::int, coalesce(sum(g.gd), 0)::int
  FROM g JOIN public.profiles pr ON pr.id = g.uid
  WHERE NOT public.has_role(g.uid, 'admin')
  GROUP BY g.uid, pr.username
  HAVING count(*) FILTER (WHERE g.won) > 0
  ORDER BY 3 DESC, 5 DESC, pr.username
  LIMIT _limit
$$;
REVOKE EXECUTE ON FUNCTION public._weekly_match_wins(timestamptz, timestamptz, integer) FROM PUBLIC, anon, authenticated;

-- Public wording of a rarest-card trophy: Secret Ultimate stays secret.
CREATE OR REPLACE FUNCTION public._rarest_label(_name text, _rarity text, _label text, _version text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _rarity = 'secret_ultimate' THEN 'Une carte ultra-secrète'
    ELSE coalesce(_name, 'Carte') || ' · ' || coalesce(_label, _rarity, '')
      || CASE _version WHEN 'alt' THEN ' ALT' WHEN 'shiny' THEN ' Shiny' ELSE '' END END
$$;

-- Admin view: the top 5 contenders for each side trophy over the last 7 days (full card detail for the admin).
CREATE OR REPLACE FUNCTION public.admin_weekly_trophies()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - interval '7 days';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  RETURN jsonb_build_object(
    'since', since, 'until', now(),
    'rarest', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public._weekly_rarest_pulls(since, now(), 5) r), '[]'::jsonb),
    'wins', coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM public._weekly_match_wins(since, now(), 5) w), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_weekly_trophies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_weekly_trophies() TO authenticated;

-- Hands a side trophy to this week's leader (computed here, never chosen by the client) during a live ceremony.
CREATE OR REPLACE FUNCTION public.admin_award_ceremony_trophy(_id uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; since timestamptz := now() - interval '7 days'; r record; w record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _kind NOT IN ('rarest_card', 'most_wins') THEN RAISE EXCEPTION 'Trophée inconnu'; END IF;
  SELECT * INTO c FROM public.ballon_dor_ceremonies WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'live' THEN RAISE EXCEPTION 'Lance la cérémonie avant de remettre les trophées'; END IF;
  IF EXISTS (SELECT 1 FROM public.ceremony_awards a WHERE a.ceremony_id = _id AND a.kind = _kind) THEN
    RAISE EXCEPTION 'Ce trophée a déjà été remis';
  END IF;
  IF _kind = 'rarest_card' THEN
    SELECT * INTO r FROM public._weekly_rarest_pulls(since, now(), 1);
    IF r.user_id IS NULL THEN RAISE EXCEPTION 'Aucune carte tirée cette semaine'; END IF;
    UPDATE public.profiles SET coins = coins + c.trophy_coins WHERE id = r.user_id;
    INSERT INTO public.ceremony_awards (ceremony_id, kind, winner_id, winner_name, detail, reward_coins)
    VALUES (_id, _kind, r.user_id, r.username, public._rarest_label(r.card_name, r.rarity, r.rarity_label, r.version), c.trophy_coins);
  ELSE
    SELECT * INTO w FROM public._weekly_match_wins(since, now(), 1);
    IF w.user_id IS NULL THEN RAISE EXCEPTION 'Aucun match gagné cette semaine'; END IF;
    UPDATE public.profiles SET coins = coins + c.trophy_coins WHERE id = w.user_id;
    INSERT INTO public.ceremony_awards (ceremony_id, kind, winner_id, winner_name, detail, reward_coins)
    VALUES (_id, _kind, w.user_id, w.username, w.wins || CASE WHEN w.wins > 1 THEN ' matchs gagnés' ELSE ' match gagné' END, c.trophy_coins);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_award_ceremony_trophy(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_award_ceremony_trophy(uuid, text) TO authenticated;

-- The Ballon d'Or comes last: every side trophy that has a contender must be handed out first.
CREATE OR REPLACE FUNCTION public.admin_award_ballon_dor(_id uuid, _winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; wname text; since timestamptz := now() - interval '7 days';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT * INTO c FROM public.ballon_dor_ceremonies WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'live' THEN RAISE EXCEPTION 'Lance la cérémonie avant de désigner le gagnant'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ceremony_awards a WHERE a.ceremony_id = _id AND a.kind = 'rarest_card')
     AND EXISTS (SELECT 1 FROM public._weekly_rarest_pulls(since, now(), 1)) THEN
    RAISE EXCEPTION 'Remets d''abord le trophée de la carte la plus rare';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ceremony_awards a WHERE a.ceremony_id = _id AND a.kind = 'most_wins')
     AND EXISTS (SELECT 1 FROM public._weekly_match_wins(since, now(), 1)) THEN
    RAISE EXCEPTION 'Remets d''abord le trophée des matchs gagnés';
  END IF;
  SELECT username INTO wname FROM public.profiles WHERE id = _winner;
  IF wname IS NULL THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
  UPDATE public.profiles SET coins = coins + c.reward_coins WHERE id = _winner;
  UPDATE public.ballon_dor_ceremonies
  SET status = 'finished', winner_id = _winner, winner_name = wname, awarded_at = now()
  WHERE id = _id;
END $$;

-- Scheduling also sets the coins paid for each side trophy (optional, so older callers keep working).
DROP FUNCTION IF EXISTS public.admin_schedule_ballon_dor(text, timestamptz, integer);
CREATE OR REPLACE FUNCTION public.admin_schedule_ballon_dor(_title text, _at timestamptz, _coins integer, _trophy_coins integer DEFAULT 500)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _at IS NULL THEN RAISE EXCEPTION 'Date obligatoire'; END IF;
  IF _coins IS NULL OR _coins < 0 OR _coins > 1000000 THEN RAISE EXCEPTION 'Récompense entre 0 et 1 000 000 pièces'; END IF;
  IF _trophy_coins IS NULL OR _trophy_coins < 0 OR _trophy_coins > 1000000 THEN RAISE EXCEPTION 'Récompense des trophées entre 0 et 1 000 000 pièces'; END IF;
  INSERT INTO public.ballon_dor_ceremonies (title, scheduled_at, reward_coins, trophy_coins)
  VALUES (coalesce(nullif(btrim(left(_title, 80)), ''), 'Ballon d''Or de la semaine'), _at, _coins, _trophy_coins)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Matches where players steer their pawns themselves: against the computer (bot levels) or a friend live.
-- The game runs in the browser (the home player hosts a live match); the server keeps teams, timing, reports and pays.
CREATE TABLE public.live_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('bot', 'live')),
  bot_level text CHECK (bot_level IN ('commune', 'legendaire', 'royal')),
  home_id uuid NOT NULL,
  away_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'finished', 'cancelled', 'declined')),
  home_team jsonb NOT NULL,
  away_team jsonb,
  home_report jsonb,
  away_report jsonb,
  home_goals integer NOT NULL DEFAULT 0,
  away_goals integer NOT NULL DEFAULT 0,
  result text CHECK (result IN ('home', 'away', 'draw')),
  winner_id uuid,
  home_reward integer,
  away_reward integer,
  forfeit_by uuid,
  disputed boolean NOT NULL DEFAULT false,
  home_seen_at timestamptz,
  away_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
GRANT SELECT ON public.live_matches TO authenticated;
GRANT ALL ON public.live_matches TO service_role;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live match participants readable" ON public.live_matches FOR SELECT TO authenticated
  USING (home_id = auth.uid() OR away_id = auth.uid());
CREATE INDEX live_matches_home_idx ON public.live_matches(home_id, status);
CREATE INDEX live_matches_away_idx ON public.live_matches(away_id, status);
CREATE INDEX live_matches_status_idx ON public.live_matches(status, started_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_matches;

-- Daily reward cap now counts simulated and steered matches together.
CREATE OR REPLACE FUNCTION public._mm_reward_ok(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.matches
      WHERE status = 'finished' AND finished_at >= date_trunc('day', now())
        AND ((home_id = _uid AND home_reward > 0) OR (away_id = _uid AND away_reward > 0)))
    + (SELECT count(*) FROM public.live_matches
      WHERE status = 'finished' AND finished_at >= date_trunc('day', now())
        AND ((home_id = _uid AND home_reward > 0) OR (away_id = _uid AND away_reward > 0))) < 5
$$;

-- Computer team: 11 catalogue players in the level's rating band, at their own position where possible.
CREATE OR REPLACE FUNCTION public._lm_bot_team(_level text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f text := (ARRAY['4-3-3', '4-4-2', '4-2-3-1'])[1 + floor(random() * 3)::int];
  roles text[] := public._mm_formation(f); lo integer; hi integer; xi jsonb := '[]'::jsonb; used uuid[] := '{}'; c record; i integer;
BEGIN
  lo := CASE _level WHEN 'commune' THEN 60 WHEN 'legendaire' THEN 84 WHEN 'royal' THEN 91 END;
  hi := CASE _level WHEN 'commune' THEN 70 WHEN 'legendaire' THEN 92 WHEN 'royal' THEN 99 END;
  IF lo IS NULL THEN RAISE EXCEPTION 'Niveau inconnu'; END IF;
  FOR i IN 1..11 LOOP
    SELECT cd.id, cd.name, cd.club, cd.nationality, upper(cd.pos) AS pos, cd.rating, cd.rarity, cd.image_url INTO c
      FROM public.cards cd
      WHERE cd.active AND upper(cd.pos) <> 'CLUB' AND cd.rating >= 40 AND public._rarity_fx(cd.rarity) <> 'secret_ultimate'
        AND NOT (cd.id = ANY(used)) AND ((upper(cd.pos) = 'G') = (roles[i] = 'G'))
      ORDER BY (cd.rating BETWEEN lo AND hi) DESC, public._mm_fit(cd.pos, roles[i]) DESC,
        CASE WHEN cd.rating BETWEEN lo AND hi THEN 0 ELSE abs(cd.rating - (lo + hi) / 2) END, random()
      LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pas assez de joueurs pour l''ordinateur'; END IF;
    used := used || c.id;
    xi := xi || jsonb_build_array(jsonb_build_object('user_card_id', NULL, 'card_id', c.id, 'name', c.name, 'club', c.club,
      'nationality', c.nationality, 'pos', c.pos, 'rating', c.rating, 'rarity', c.rarity, 'version', 'normal', 'image_url', c.image_url));
  END LOOP;
  RETURN public._mm_rate(f, 'equilibre', xi, '[]'::jsonb);
END $$;

-- Ends a steered match: winner gets the win payout, loser the loss payout, a draw pays both the same (daily cap applies).
CREATE OR REPLACE FUNCTION public._lm_finish(_id uuid, _hg integer, _ag integer, _forfeit uuid, _disputed boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.live_matches%rowtype; sa numeric; ch integer := 0; ca integer := 0; xh integer; xa integer;
BEGIN
  SELECT * INTO m FROM public.live_matches WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'playing' THEN RETURN; END IF;
  sa := CASE WHEN _hg > _ag THEN 1 WHEN _ag > _hg THEN 0 ELSE 0.5 END;
  IF _forfeit IS DISTINCT FROM m.home_id AND public._mm_reward_ok(m.home_id) THEN ch := public._mm_payout(sa); END IF;
  IF m.away_id IS NOT NULL AND _forfeit IS DISTINCT FROM m.away_id AND public._mm_reward_ok(m.away_id) THEN ca := public._mm_payout(1 - sa); END IF;
  xh := CASE ch WHEN 150 THEN 40 WHEN 60 THEN 20 WHEN 30 THEN 10 ELSE 0 END;
  xa := CASE ca WHEN 150 THEN 40 WHEN 60 THEN 20 WHEN 30 THEN 10 ELSE 0 END;
  IF ch > 0 THEN UPDATE public.profiles SET coins = coins + ch, xp = xp + xh, level = ((xp + xh) / 100) + 1 WHERE id = m.home_id; END IF;
  IF ca > 0 THEN UPDATE public.profiles SET coins = coins + ca, xp = xp + xa, level = ((xp + xa) / 100) + 1 WHERE id = m.away_id; END IF;
  UPDATE public.live_matches SET status = 'finished', home_goals = _hg, away_goals = _ag,
    result = CASE WHEN sa = 1 THEN 'home' WHEN sa = 0 THEN 'away' ELSE 'draw' END,
    winner_id = CASE WHEN sa = 1 THEN m.home_id WHEN sa = 0 THEN m.away_id END,
    home_reward = ch, away_reward = ca, forfeit_by = _forfeit, disputed = _disputed, finished_at = now()
    WHERE id = m.id;
END $$;

-- Lazy timeouts: invites last 10 min; a lone report is accepted 6 min after kick-off; silent matches are cancelled.
CREATE OR REPLACE FUNCTION public._settle_live_matches() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; r jsonb;
BEGIN
  UPDATE public.live_matches SET status = 'cancelled', finished_at = now()
    WHERE status = 'pending' AND created_at < now() - interval '10 minutes';
  FOR m IN SELECT * FROM public.live_matches WHERE status = 'playing' AND started_at < now() - interval '6 minutes' FOR UPDATE SKIP LOCKED LOOP
    r := coalesce(m.home_report, m.away_report);
    IF r IS NOT NULL THEN
      PERFORM public._lm_finish(m.id, (r->>'home')::int, (r->>'away')::int, NULL);
    ELSIF m.started_at < now() - interval '20 minutes' THEN
      UPDATE public.live_matches SET status = 'cancelled', finished_at = now() WHERE id = m.id;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.start_bot_match(_level text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); mid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF _level NOT IN ('commune', 'legendaire', 'royal') THEN RAISE EXCEPTION 'Niveau inconnu'; END IF;
  PERFORM public._settle_live_matches();
  -- Starting a new game abandons an unfinished one against the computer (no reward).
  UPDATE public.live_matches SET status = 'cancelled', forfeit_by = uid, finished_at = now()
    WHERE mode = 'bot' AND home_id = uid AND status = 'playing';
  INSERT INTO public.live_matches (mode, bot_level, home_id, status, home_team, away_team, started_at, home_seen_at)
    VALUES ('bot', _level, uid, 'playing', public._mm_snapshot(uid), public._lm_bot_team(_level), now(), now())
    RETURNING id INTO mid;
  RETURN mid;
END $$;

CREATE OR REPLACE FUNCTION public.create_live_match(_opponent uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); mid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_live_matches();
  IF _opponent IS NULL OR _opponent = uid THEN RAISE EXCEPTION 'Choisis un ami'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted'
      AND ((requester_id = uid AND addressee_id = _opponent) OR (requester_id = _opponent AND addressee_id = uid))) THEN
    RAISE EXCEPTION 'Tu ne peux défier en direct que tes amis';
  END IF;
  IF (SELECT count(*) FROM public.live_matches WHERE mode = 'live' AND home_id = uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'Tu as déjà 3 invitations en attente';
  END IF;
  UPDATE public.live_matches SET status = 'cancelled', finished_at = now()
    WHERE mode = 'live' AND status = 'pending' AND home_id = uid AND away_id = _opponent;
  INSERT INTO public.live_matches (mode, home_id, away_id, home_team, home_seen_at)
    VALUES ('live', uid, _opponent, public._mm_snapshot(uid), now()) RETURNING id INTO mid;
  RETURN mid;
END $$;

CREATE OR REPLACE FUNCTION public.accept_live_match(_match_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.live_matches%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_live_matches();
  SELECT * INTO m FROM public.live_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR m.mode <> 'live' OR m.status <> 'pending' OR m.away_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Cette invitation n''est plus disponible';
  END IF;
  UPDATE public.live_matches SET status = 'playing', away_team = public._mm_snapshot(uid), started_at = now(), away_seen_at = now()
    WHERE id = m.id;
  RETURN m.id;
END $$;

-- Heartbeat while the match page is open; lets the other player claim the win if one side disappears.
CREATE OR REPLACE FUNCTION public.live_ping(_match_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  UPDATE public.live_matches SET home_seen_at = CASE WHEN home_id = uid THEN now() ELSE home_seen_at END,
      away_seen_at = CASE WHEN away_id = uid THEN now() ELSE away_seen_at END
    WHERE id = _match_id AND (home_id = uid OR away_id = uid) AND status IN ('pending', 'playing')
    RETURNING status INTO st;
  IF st IS NULL THEN SELECT status INTO st FROM public.live_matches WHERE id = _match_id AND (home_id = uid OR away_id = uid); END IF;
  RETURN st;
END $$;

CREATE OR REPLACE FUNCTION public.report_live_result(_match_id uuid, _home integer, _away integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.live_matches%rowtype; rep jsonb; other jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO m FROM public.live_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF m.status <> 'playing' THEN RETURN; END IF;
  IF _home IS NULL OR _away IS NULL OR _home < 0 OR _away < 0 OR _home > 30 OR _away > 30 THEN RAISE EXCEPTION 'Score impossible'; END IF;
  IF m.started_at > now() - interval '150 seconds' THEN RAISE EXCEPTION 'Le match n''est pas encore terminé'; END IF;
  rep := jsonb_build_object('home', _home, 'away', _away);
  IF m.mode = 'bot' THEN
    PERFORM public._lm_finish(m.id, _home, _away, NULL);
    RETURN;
  END IF;
  IF uid = m.home_id THEN
    UPDATE public.live_matches SET home_report = rep WHERE id = m.id; other := m.away_report;
  ELSE
    UPDATE public.live_matches SET away_report = rep WHERE id = m.id; other := m.home_report;
  END IF;
  IF other IS NOT NULL THEN
    IF other = rep THEN PERFORM public._lm_finish(m.id, _home, _away, NULL);
    ELSE PERFORM public._lm_finish(m.id, 0, 0, NULL, true);
    END IF;
  END IF;
END $$;

-- Leaving: an invite is cancelled or declined; leaving a match under way loses it 3-0 with no coins.
CREATE OR REPLACE FUNCTION public.leave_live_match(_match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.live_matches%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO m FROM public.live_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF m.status = 'pending' THEN
    UPDATE public.live_matches SET status = CASE WHEN uid = m.home_id THEN 'cancelled' ELSE 'declined' END, finished_at = now() WHERE id = m.id;
  ELSIF m.status = 'playing' THEN
    IF uid = m.home_id THEN PERFORM public._lm_finish(m.id, 0, 3, uid); ELSE PERFORM public._lm_finish(m.id, 3, 0, uid); END IF;
  END IF;
END $$;

-- The other player has not been seen for 25 s: the one still here wins 3-0.
CREATE OR REPLACE FUNCTION public.claim_live_forfeit(_match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.live_matches%rowtype; seen timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO m FROM public.live_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR m.mode <> 'live' OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF m.status <> 'playing' THEN RETURN; END IF;
  seen := CASE WHEN uid = m.home_id THEN coalesce(m.away_seen_at, m.started_at) ELSE coalesce(m.home_seen_at, m.started_at) END;
  IF seen > now() - interval '25 seconds' THEN RAISE EXCEPTION 'Ton adversaire est toujours là'; END IF;
  IF uid = m.home_id THEN PERFORM public._lm_finish(m.id, 3, 0, m.away_id); ELSE PERFORM public._lm_finish(m.id, 0, 3, m.home_id); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_live_match(_match_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.live_matches%rowtype; hn text; an text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_live_matches();
  SELECT * INTO m FROM public.live_matches WHERE id = _match_id;
  IF NOT FOUND OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  SELECT username INTO hn FROM public.profiles WHERE id = m.home_id;
  SELECT username INTO an FROM public.profiles WHERE id = m.away_id;
  RETURN jsonb_build_object('id', m.id, 'mode', m.mode, 'bot_level', m.bot_level, 'status', m.status,
    'side', CASE WHEN uid = m.home_id THEN 'home' ELSE 'away' END, 'result', m.result, 'disputed', m.disputed,
    'forfeit_by', CASE WHEN m.forfeit_by IS NULL THEN NULL WHEN m.forfeit_by = m.home_id THEN 'home' ELSE 'away' END,
    'home', jsonb_build_object('id', m.home_id, 'name', hn, 'team', m.home_team, 'goals', m.home_goals, 'reward', m.home_reward,
      'reported', m.home_report IS NOT NULL),
    'away', jsonb_build_object('id', m.away_id, 'name', an, 'team', m.away_team, 'goals', m.away_goals, 'reward', m.away_reward,
      'reported', m.away_report IS NOT NULL),
    'created_at', m.created_at, 'started_at', m.started_at, 'finished_at', m.finished_at, 'now', now());
END $$;

CREATE OR REPLACE FUNCTION public.get_my_live_matches()
RETURNS TABLE(match_id uuid, mode text, bot_level text, status text, is_home boolean, opponent_name text,
  my_goals integer, their_goals integer, result text, my_reward integer, incoming boolean, created_at timestamptz, finished_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_live_matches();
  RETURN QUERY
  SELECT m.id, m.mode, m.bot_level, m.status, m.home_id = uid, p.username,
    CASE WHEN m.home_id = uid THEN m.home_goals ELSE m.away_goals END,
    CASE WHEN m.home_id = uid THEN m.away_goals ELSE m.home_goals END,
    CASE WHEN m.status <> 'finished' THEN NULL WHEN m.result = 'draw' THEN 'draw'
      WHEN (m.result = 'home') = (m.home_id = uid) THEN 'win' ELSE 'loss' END,
    CASE WHEN m.home_id = uid THEN m.home_reward ELSE m.away_reward END,
    m.status = 'pending' AND m.away_id = uid,
    m.created_at, m.finished_at
  FROM public.live_matches m
  LEFT JOIN public.profiles p ON p.id = CASE WHEN m.home_id = uid THEN m.away_id ELSE m.home_id END
  WHERE (m.home_id = uid OR m.away_id = uid)
    AND (m.status IN ('pending', 'playing') OR (m.status = 'finished' AND m.finished_at > now() - interval '14 days'))
  ORDER BY m.finished_at DESC NULLS FIRST, m.created_at DESC
  LIMIT 30;
END $$;

REVOKE EXECUTE ON FUNCTION public._lm_bot_team(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lm_finish(uuid, integer, integer, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._settle_live_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_reward_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_bot_match(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_live_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_live_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.live_ping(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.report_live_result(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_live_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_live_forfeit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_live_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_live_matches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_bot_match(text), public.create_live_match(uuid), public.accept_live_match(uuid),
  public.live_ping(uuid), public.report_live_result(uuid, integer, integer), public.leave_live_match(uuid),
  public.claim_live_forfeit(uuid), public.get_live_match(uuid), public.get_my_live_matches() TO authenticated;

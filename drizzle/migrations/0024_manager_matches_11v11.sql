-- 11 v 11 manager mode: a saved team per player, matches simulated server-side half by half.
CREATE TABLE public.manager_teams (
  user_id uuid PRIMARY KEY,
  formation text NOT NULL,
  tactic text NOT NULL DEFAULT 'equilibre',
  starters uuid[] NOT NULL,
  bench uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manager_teams TO authenticated;
GRANT ALL ON public.manager_teams TO service_role;
ALTER TABLE public.manager_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own manager team readable" ON public.manager_teams FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL,
  away_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'halftime', 'finished', 'cancelled', 'declined')),
  home_team jsonb NOT NULL,
  away_team jsonb,
  home_team2 jsonb,
  away_team2 jsonb,
  first_half jsonb,
  second_half jsonb,
  home_goals integer NOT NULL DEFAULT 0,
  away_goals integer NOT NULL DEFAULT 0,
  winner_id uuid,
  home_reward integer,
  away_reward integer,
  home_elo_delta integer,
  away_elo_delta integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  halftime_at timestamptz,
  finished_at timestamptz
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match participants readable" ON public.matches FOR SELECT TO authenticated
  USING (home_id = auth.uid() OR away_id = auth.uid());
CREATE INDEX matches_home_idx ON public.matches(home_id, status);
CREATE INDEX matches_away_idx ON public.matches(away_id, status);
CREATE INDEX matches_status_idx ON public.matches(status, halftime_at);

-- Half-time choices stay hidden until the second half is played.
CREATE TABLE public.match_halftime (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  team jsonb NOT NULL,
  subs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);
GRANT ALL ON public.match_halftime TO service_role;
ALTER TABLE public.match_halftime ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.match_stats (
  user_id uuid PRIMARY KEY,
  rating integer NOT NULL DEFAULT 1000,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  played integer NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_stats TO anon, authenticated;
GRANT ALL ON public.match_stats TO service_role;
ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match stats readable" ON public.match_stats FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Formation slots (position played) and the line each slot belongs to. Mirrored by FORMATIONS in src/lib/manager.ts.
CREATE OR REPLACE FUNCTION public._mm_formation(_f text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _f
    WHEN '4-3-3' THEN ARRAY['G','DG','DC','DC','DD','MC','MDC','MC','AG','BU','AD']
    WHEN '4-4-2' THEN ARRAY['G','DG','DC','DC','DD','AG','MC','MC','AD','BU','BU']
    WHEN '4-2-3-1' THEN ARRAY['G','DG','DC','DC','DD','MDC','MDC','AG','MOC','AD','BU']
    WHEN '3-4-3' THEN ARRAY['G','DC','DC','DC','DG','MC','MC','DD','AG','BU','AD']
    WHEN '5-3-2' THEN ARRAY['G','DG','DC','DC','DC','DD','MC','MDC','MC','BU','BU']
  END
$$;

CREATE OR REPLACE FUNCTION public._mm_lines(_f text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _f
    WHEN '4-3-3' THEN ARRAY['gk','def','def','def','def','mid','mid','mid','att','att','att']
    WHEN '4-4-2' THEN ARRAY['gk','def','def','def','def','mid','mid','mid','mid','att','att']
    WHEN '4-2-3-1' THEN ARRAY['gk','def','def','def','def','mid','mid','att','mid','att','att']
    WHEN '3-4-3' THEN ARRAY['gk','def','def','def','mid','mid','mid','mid','att','att','att']
    WHEN '5-3-2' THEN ARRAY['gk','def','def','def','def','def','mid','mid','mid','att','att']
  END
$$;

-- 0 at his position, -3 at a close one, -10 elsewhere, -30 for a keeper out of goal or an outfield player in goal.
CREATE OR REPLACE FUNCTION public._mm_fit(_pos text, _role text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN upper(_pos) = _role THEN 0
    WHEN upper(_pos) = 'G' OR _role = 'G' THEN -30
    WHEN (_role, upper(_pos)) IN (('BU','AD'),('BU','AG'),('BU','MOC'),('AD','AG'),('AD','BU'),('AG','AD'),('AG','BU'),
      ('MOC','MC'),('MOC','BU'),('MC','MDC'),('MC','MOC'),('MDC','MC'),('MDC','DC'),('DC','MDC'),('DC','DD'),('DC','DG'),
      ('DD','DG'),('DD','DC'),('DG','DD'),('DG','DC')) THEN -3
    ELSE -10 END
$$;

CREATE OR REPLACE FUNCTION public._mm_rarity_bonus(_rarity text, _version text) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT CASE public._rarity_fx(_rarity) WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2 WHEN 'super_rare' THEN 3
      WHEN 'legendary' THEN 4 WHEN 'secret_legendary' THEN 5 ELSE 0 END
    + CASE WHEN _version IN ('alt', 'shiny') THEN 2 ELSE 0 END
$$;

-- Rates a lineup: per player fit, collectif (club/nationality mates in the XI) and effective rating; team lines and totals.
CREATE OR REPLACE FUNCTION public._mm_rate(_formation text, _tactic text, _xi jsonb, _bench jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  roles text[] := public._mm_formation(_formation); lines text[] := public._mm_lines(_formation);
  out jsonb := '[]'::jsonb; p jsonb; i integer; cm integer; nm integer; fit integer; chem integer; eff integer;
  att_s numeric := 0; att_n integer := 0; mid_s numeric := 0; mid_n integer := 0; def_s numeric := 0; def_n integer := 0;
  gk numeric := 0; rating_s integer := 0; chem_s integer := 0; eff_s integer := 0; t_att integer; att numeric; mid numeric; def numeric;
BEGIN
  IF roles IS NULL THEN RAISE EXCEPTION 'Formation inconnue'; END IF;
  IF jsonb_array_length(_xi) <> 11 THEN RAISE EXCEPTION 'Il faut 11 titulaires'; END IF;
  FOR i IN 0..10 LOOP
    p := _xi->i;
    fit := public._mm_fit(p->>'pos', roles[i + 1]);
    SELECT count(*) FILTER (WHERE lower(q->>'club') = lower(p->>'club')),
           count(*) FILTER (WHERE lower(q->>'nationality') = lower(p->>'nationality'))
      INTO cm, nm
      FROM jsonb_array_elements(_xi) WITH ORDINALITY AS t(q, o) WHERE o - 1 <> i;
    chem := CASE WHEN fit <= -10 THEN 0 ELSE
      (CASE WHEN cm >= 2 THEN 2 WHEN cm = 1 THEN 1 ELSE 0 END) + (CASE WHEN nm >= 4 THEN 2 WHEN nm >= 2 THEN 1 ELSE 0 END) END;
    eff := (p->>'rating')::int + public._mm_rarity_bonus(p->>'rarity', p->>'version') + chem + fit;
    out := out || jsonb_build_array(p || jsonb_build_object('slot', i, 'role', roles[i + 1], 'line', lines[i + 1], 'fit', fit, 'chem', chem, 'eff', eff));
    rating_s := rating_s + (p->>'rating')::int; chem_s := chem_s + chem; eff_s := eff_s + eff;
    CASE lines[i + 1]
      WHEN 'gk' THEN gk := eff;
      WHEN 'def' THEN def_s := def_s + eff; def_n := def_n + 1;
      WHEN 'mid' THEN mid_s := mid_s + eff; mid_n := mid_n + 1;
      ELSE att_s := att_s + eff; att_n := att_n + 1;
    END CASE;
  END LOOP;
  t_att := CASE _tactic WHEN 'offensive' THEN 3 WHEN 'defensive' THEN -3 ELSE 0 END;
  mid := mid_s / mid_n + (mid_n - 3) * 2;
  att := 0.65 * att_s / att_n + 0.35 * mid_s / mid_n + (att_n - 3) * 2 + t_att;
  def := 0.75 * def_s / def_n + 0.25 * mid_s / mid_n + (def_n - 4) * 2 - t_att;
  RETURN jsonb_build_object(
    'formation', _formation, 'tactic', _tactic, 'players', out, 'bench', coalesce(_bench, '[]'::jsonb),
    'general', round(rating_s / 11.0), 'collectif', round(chem_s * 100 / 44.0), 'force', round(eff_s / 11.0),
    'attack', round(att, 1), 'midfield', round(mid, 1), 'defense', round(def, 1), 'keeper', gk);
END $$;

CREATE OR REPLACE FUNCTION public._mm_cards(_uid uuid, _ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; n integer; bad integer;
BEGIN
  IF coalesce(array_length(_ids, 1), 0) = 0 THEN RETURN '[]'::jsonb; END IF;
  SELECT count(*), count(*) FILTER (WHERE upper(c.pos) = 'CLUB' OR public._rarity_fx(c.rarity) = 'secret_ultimate')
    INTO n, bad
    FROM unnest(_ids) AS u(id)
    JOIN public.user_cards uc ON uc.id = u.id AND uc.user_id = _uid
    JOIN public.cards c ON c.id = uc.card_id;
  IF n <> array_length(_ids, 1) THEN
    RAISE EXCEPTION 'Ton équipe contient une carte que tu n''as plus : modifie-la dans « Mon équipe »';
  END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Les cartes Club et Secrète Ultime ne jouent pas en match'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
      'user_card_id', uc.id, 'card_id', c.id, 'name', c.name, 'club', c.club, 'nationality', c.nationality,
      'pos', upper(c.pos), 'rating', c.rating, 'rarity', c.rarity, 'version', uc.version,
      'image_url', CASE WHEN uc.version = 'alt' THEN coalesce(c.alt_image_url, c.image_url) ELSE c.image_url END) ORDER BY u.ord)
    INTO res
    FROM unnest(_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.user_cards uc ON uc.id = u.id
    JOIN public.cards c ON c.id = uc.card_id;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public._mm_snapshot(_uid uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.manager_teams%rowtype;
BEGIN
  SELECT * INTO t FROM public.manager_teams WHERE user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compose d''abord ton équipe de 11 dans « Mon équipe »'; END IF;
  RETURN public._mm_rate(t.formation, t.tactic, public._mm_cards(_uid, t.starters), public._mm_cards(_uid, t.bench));
END $$;

CREATE OR REPLACE FUNCTION public.save_manager_team(_formation text, _tactic text, _starters uuid[], _bench uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b uuid[] := coalesce(_bench, '{}'); allc jsonb; nb integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF public._mm_formation(_formation) IS NULL THEN RAISE EXCEPTION 'Formation inconnue'; END IF;
  IF _tactic NOT IN ('offensive', 'equilibre', 'defensive') THEN RAISE EXCEPTION 'Tactique inconnue'; END IF;
  IF coalesce(array_length(_starters, 1), 0) <> 11 OR array_position(_starters, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Choisis tes 11 titulaires';
  END IF;
  nb := coalesce(array_length(b, 1), 0);
  IF nb > 5 OR array_position(b, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Tu peux avoir 5 remplaçants au maximum'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(_starters || b) x) <> 11 + nb THEN RAISE EXCEPTION 'Une même carte est choisie deux fois'; END IF;
  allc := public._mm_cards(uid, _starters || b);
  IF (SELECT count(DISTINCT q->>'card_id') FROM jsonb_array_elements(allc) q) <> 11 + nb THEN
    RAISE EXCEPTION 'Un même joueur ne peut pas être deux fois dans ton équipe';
  END IF;
  INSERT INTO public.manager_teams (user_id, formation, tactic, starters, bench, updated_at)
    VALUES (uid, _formation, _tactic, _starters, b, now())
    ON CONFLICT (user_id) DO UPDATE SET formation = excluded.formation, tactic = excluded.tactic,
      starters = excluded.starters, bench = excluded.bench, updated_at = now();
  RETURN public._mm_snapshot(uid);
END $$;

-- One half: 7 to 10 chances. Midfield decides who attacks, attack vs defence and keeper decide the outcome.
CREATE OR REPLACE FUNCTION public._mm_sim_half(_h jsonb, _a jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  n integer; times numeric[]; k integer; ev jsonb := '[]'::jsonb; hg integer := 0; ag integer := 0;
  ph numeric; side text; atk jsonb; dfd jsonb; pg numeric; r numeric; kind text;
  shooter integer; assist integer; defender integer; keeper integer;
BEGIN
  n := 7 + floor(random() * 4)::int;
  SELECT array_agg(x ORDER BY x) INTO times FROM (SELECT round((4 + random() * 72)::numeric, 1) AS x FROM generate_series(1, n)) s;
  ph := least(0.78, greatest(0.22, 0.5 + ((_h->>'midfield')::numeric - (_a->>'midfield')::numeric) / 30
    + ((_h->>'attack')::numeric - (_a->>'attack')::numeric) / 90));
  FOR k IN 1..n LOOP
    side := CASE WHEN random() < ph THEN 'home' ELSE 'away' END;
    atk := CASE WHEN side = 'home' THEN _h ELSE _a END;
    dfd := CASE WHEN side = 'home' THEN _a ELSE _h END;
    pg := least(0.5, greatest(0.05, 0.15 + ((atk->>'attack')::numeric - (dfd->>'defense')::numeric) / 45
      + ((atk->>'attack')::numeric - (dfd->>'keeper')::numeric) / 90));
    r := random();
    kind := CASE WHEN r < pg THEN 'goal' WHEN r < pg + (1 - pg) * 0.4 THEN 'save' WHEN r < pg + (1 - pg) * 0.7 THEN 'miss' ELSE 'tackle' END;
    SELECT (q->>'slot')::int INTO shooter FROM jsonb_array_elements(atk->'players') q
      WHERE q->>'line' <> 'gk'
      ORDER BY -ln(1 - random()) / ((CASE q->>'line' WHEN 'att' THEN 6 WHEN 'mid' THEN 2.2 ELSE 0.4 END)
        * power(greatest((q->>'eff')::numeric, 30) / 80, 4)) LIMIT 1;
    SELECT (q->>'slot')::int INTO assist FROM jsonb_array_elements(atk->'players') q
      WHERE q->>'line' IN ('mid', 'att') AND (q->>'slot')::int <> shooter
      ORDER BY -ln(1 - random()) / ((CASE q->>'line' WHEN 'mid' THEN 3 ELSE 2 END)
        * power(greatest((q->>'eff')::numeric, 30) / 80, 3)) LIMIT 1;
    SELECT (q->>'slot')::int INTO defender FROM jsonb_array_elements(dfd->'players') q
      WHERE q->>'line' = 'def'
      ORDER BY -ln(1 - random()) / power(greatest((q->>'eff')::numeric, 30) / 80, 3) LIMIT 1;
    SELECT (q->>'slot')::int INTO keeper FROM jsonb_array_elements(dfd->'players') q WHERE q->>'line' = 'gk' LIMIT 1;
    IF kind = 'goal' THEN
      IF side = 'home' THEN hg := hg + 1; ELSE ag := ag + 1; END IF;
    END IF;
    ev := ev || jsonb_build_array(jsonb_build_object('t', times[k], 'side', side, 'kind', kind,
      'shooter', shooter, 'assist', assist, 'defender', defender, 'keeper', keeper));
  END LOOP;
  RETURN jsonb_build_object('events', ev, 'home', hg, 'away', ag);
END $$;

CREATE OR REPLACE FUNCTION public._mm_payout(_score numeric) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _score = 1 THEN 150 WHEN _score = 0.5 THEN 60 ELSE 30 END
$$;

CREATE OR REPLACE FUNCTION public._mm_reward_ok(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) < 5 FROM public.matches
  WHERE status = 'finished' AND finished_at >= date_trunc('day', now())
    AND ((home_id = _uid AND home_reward > 0) OR (away_id = _uid AND away_reward > 0))
$$;

CREATE OR REPLACE FUNCTION public._mm_second_half(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.matches%rowtype; h2 jsonb; a2 jsonb; sim jsonb; hg integer; ag integer; w uuid;
  ra integer; rb integer; sa numeric; ea numeric; da integer; ch integer := 0; ca integer := 0; xh integer; xa integer;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'halftime' THEN RETURN; END IF;
  SELECT team INTO h2 FROM public.match_halftime WHERE match_id = m.id AND player_id = m.home_id;
  SELECT team INTO a2 FROM public.match_halftime WHERE match_id = m.id AND player_id = m.away_id;
  h2 := coalesce(h2, m.home_team); a2 := coalesce(a2, m.away_team);
  sim := public._mm_sim_half(h2, a2);
  hg := m.home_goals + (sim->>'home')::int; ag := m.away_goals + (sim->>'away')::int;
  w := CASE WHEN hg > ag THEN m.home_id WHEN ag > hg THEN m.away_id END;
  INSERT INTO public.match_stats (user_id) VALUES (m.home_id), (m.away_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT rating INTO ra FROM public.match_stats WHERE user_id = m.home_id FOR UPDATE;
  SELECT rating INTO rb FROM public.match_stats WHERE user_id = m.away_id FOR UPDATE;
  sa := CASE WHEN hg > ag THEN 1 WHEN ag > hg THEN 0 ELSE 0.5 END;
  ea := 1 / (1 + power(10::numeric, (rb - ra) / 400.0));
  da := round(32 * (sa - ea));
  IF public._mm_reward_ok(m.home_id) THEN ch := public._mm_payout(sa); END IF;
  IF public._mm_reward_ok(m.away_id) THEN ca := public._mm_payout(1 - sa); END IF;
  xh := CASE ch WHEN 150 THEN 40 WHEN 60 THEN 20 WHEN 30 THEN 10 ELSE 0 END;
  xa := CASE ca WHEN 150 THEN 40 WHEN 60 THEN 20 WHEN 30 THEN 10 ELSE 0 END;
  UPDATE public.profiles SET coins = coins + ch, xp = xp + xh, level = ((xp + xh) / 100) + 1 WHERE id = m.home_id;
  UPDATE public.profiles SET coins = coins + ca, xp = xp + xa, level = ((xp + xa) / 100) + 1 WHERE id = m.away_id;
  UPDATE public.match_stats SET rating = greatest(0, rating + da), wins = wins + (sa = 1)::int, losses = losses + (sa = 0)::int,
    draws = draws + (sa = 0.5)::int, played = played + 1, goals_for = goals_for + hg, goals_against = goals_against + ag,
    updated_at = now() WHERE user_id = m.home_id;
  UPDATE public.match_stats SET rating = greatest(0, rating - da), wins = wins + (sa = 0)::int, losses = losses + (sa = 1)::int,
    draws = draws + (sa = 0.5)::int, played = played + 1, goals_for = goals_for + ag, goals_against = goals_against + hg,
    updated_at = now() WHERE user_id = m.away_id;
  UPDATE public.matches SET status = 'finished', home_team2 = h2, away_team2 = a2, second_half = sim,
    home_goals = hg, away_goals = ag, winner_id = w, home_reward = ch, away_reward = ca,
    home_elo_delta = da, away_elo_delta = -da, finished_at = now()
    WHERE id = m.id;
END $$;

-- Lazy timeouts (no cron): invitations expire after 48 h; after 24 h at half-time the second half is played with the choices made.
CREATE OR REPLACE FUNCTION public._settle_matches() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  UPDATE public.matches SET status = 'cancelled', finished_at = now()
    WHERE status = 'pending' AND created_at < now() - interval '48 hours';
  FOR m IN SELECT id FROM public.matches WHERE status = 'halftime' AND halftime_at < now() - interval '24 hours' FOR UPDATE SKIP LOCKED LOOP
    PERFORM public._mm_second_half(m.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_match(_opponent uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); team jsonb; mid uuid; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_matches();
  IF _opponent = uid THEN RAISE EXCEPTION 'Tu ne peux pas jouer contre toi-même'; END IF;
  IF _opponent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _opponent) THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
  SELECT count(*) INTO n FROM public.matches WHERE status IN ('pending', 'halftime') AND (home_id = uid OR away_id = uid);
  IF n >= 10 THEN RAISE EXCEPTION 'Tu as déjà 10 matchs en cours'; END IF;
  team := public._mm_snapshot(uid);
  INSERT INTO public.matches (home_id, away_id, home_team) VALUES (uid, _opponent, team) RETURNING id INTO mid;
  RETURN mid;
END $$;

CREATE OR REPLACE FUNCTION public.accept_match(_match_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches%rowtype; team jsonb; sim jsonb; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_matches();
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'pending' OR (m.away_id IS NOT NULL AND m.away_id <> uid) THEN
    RAISE EXCEPTION 'Ce match n''est plus disponible';
  END IF;
  IF m.home_id = uid THEN RAISE EXCEPTION 'Tu ne peux pas accepter ton propre défi'; END IF;
  SELECT count(*) INTO n FROM public.matches WHERE status IN ('pending', 'halftime') AND id <> m.id AND (home_id = uid OR away_id = uid);
  IF n >= 10 THEN RAISE EXCEPTION 'Tu as déjà 10 matchs en cours'; END IF;
  team := public._mm_snapshot(uid);
  sim := public._mm_sim_half(m.home_team, team);
  UPDATE public.matches SET away_id = uid, away_team = team, first_half = sim, status = 'halftime', halftime_at = now(),
    home_goals = (sim->>'home')::int, away_goals = (sim->>'away')::int
    WHERE id = m.id;
  RETURN m.id;
END $$;

-- Half-time: up to 3 substitutions from the bench and a new tactic. The second half plays once both managers are ready.
CREATE OR REPLACE FUNCTION public.submit_halftime(_match_id uuid, _tactic text, _subs jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); m public.matches%rowtype; team jsonb; xi jsonb; bench jsonb; s jsonb; o integer; i integer;
  outs integer[] := '{}'; ins integer[] := '{}'; nb integer; newbench jsonb := '[]'::jsonb; k integer; other uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_matches();
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF m.status <> 'halftime' THEN RAISE EXCEPTION 'Ce match n''est pas à la mi-temps'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_halftime WHERE match_id = m.id AND player_id = uid) THEN
    RAISE EXCEPTION 'Tu as déjà validé ta mi-temps';
  END IF;
  IF _tactic NOT IN ('offensive', 'equilibre', 'defensive') THEN RAISE EXCEPTION 'Tactique inconnue'; END IF;
  IF _subs IS NULL OR jsonb_typeof(_subs) <> 'array' THEN _subs := '[]'::jsonb; END IF;
  IF jsonb_array_length(_subs) > 3 THEN RAISE EXCEPTION '3 changements au maximum'; END IF;
  team := CASE WHEN uid = m.home_id THEN m.home_team ELSE m.away_team END;
  xi := team->'players'; bench := coalesce(team->'bench', '[]'::jsonb); nb := jsonb_array_length(bench);
  FOR s IN SELECT * FROM jsonb_array_elements(_subs) LOOP
    o := (s->>'out')::int; i := (s->>'in')::int;
    IF o IS NULL OR i IS NULL OR o < 0 OR o > 10 OR i < 0 OR i >= nb OR o = ANY(outs) OR i = ANY(ins) THEN
      RAISE EXCEPTION 'Changement impossible';
    END IF;
    outs := outs || o; ins := ins || i;
    xi := jsonb_set(xi, ARRAY[o::text], bench->i);
  END LOOP;
  FOR k IN 0..nb - 1 LOOP
    IF NOT k = ANY(ins) THEN newbench := newbench || jsonb_build_array(bench->k); END IF;
  END LOOP;
  -- Keep only card fields so the lineup is rated afresh.
  SELECT jsonb_agg(q - 'slot' - 'role' - 'line' - 'fit' - 'chem' - 'eff' ORDER BY o2) INTO xi
    FROM jsonb_array_elements(xi) WITH ORDINALITY AS t(q, o2);
  INSERT INTO public.match_halftime (match_id, player_id, team, subs)
    VALUES (m.id, uid, public._mm_rate(team->>'formation', _tactic, xi, newbench), _subs);
  other := CASE WHEN uid = m.home_id THEN m.away_id ELSE m.home_id END;
  IF EXISTS (SELECT 1 FROM public.match_halftime WHERE match_id = m.id AND player_id = other) THEN
    PERFORM public._mm_second_half(m.id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.leave_match(_match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND OR (uid <> m.home_id AND uid IS DISTINCT FROM m.away_id) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF m.status <> 'pending' THEN RAISE EXCEPTION 'Ce match a déjà commencé'; END IF;
  UPDATE public.matches SET status = CASE WHEN uid = m.home_id THEN 'cancelled' ELSE 'declined' END, finished_at = now() WHERE id = m.id;
END $$;

CREATE OR REPLACE FUNCTION public.get_match(_match_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); m public.matches%rowtype; side text; hn text; an text; hr jsonb; ar jsonb; mine jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_matches();
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  side := CASE WHEN uid = m.home_id THEN 'home' WHEN uid = m.away_id THEN 'away' END;
  IF side IS NULL AND NOT (m.status = 'pending' AND m.away_id IS NULL) THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  SELECT username INTO hn FROM public.profiles WHERE id = m.home_id;
  SELECT username INTO an FROM public.profiles WHERE id = m.away_id;
  SELECT team INTO mine FROM public.match_halftime WHERE match_id = m.id AND player_id = uid;
  RETURN jsonb_build_object(
    'id', m.id, 'status', m.status, 'side', side, 'winner_id', m.winner_id,
    'home', jsonb_build_object('id', m.home_id, 'name', hn, 'team', m.home_team, 'team2', m.home_team2, 'goals', m.home_goals,
      'reward', m.home_reward, 'elo_delta', m.home_elo_delta,
      'ready', EXISTS (SELECT 1 FROM public.match_halftime WHERE match_id = m.id AND player_id = m.home_id)),
    'away', jsonb_build_object('id', m.away_id, 'name', an, 'team', m.away_team, 'team2', m.away_team2, 'goals', m.away_goals,
      'reward', m.away_reward, 'elo_delta', m.away_elo_delta,
      'ready', EXISTS (SELECT 1 FROM public.match_halftime WHERE match_id = m.id AND player_id = m.away_id)),
    'first_half', m.first_half, 'second_half', m.second_half, 'my_halftime', mine,
    'created_at', m.created_at, 'halftime_at', m.halftime_at, 'finished_at', m.finished_at);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_matches()
RETURNS TABLE(match_id uuid, status text, is_home boolean, opponent_id uuid, opponent_name text, my_goals integer,
  their_goals integer, needs_me boolean, incoming boolean, open_invite boolean, they_ready boolean, result text,
  my_reward integer, my_elo_delta integer, my_general integer, their_general integer,
  created_at timestamptz, halftime_at timestamptz, finished_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_matches();
  RETURN QUERY
  SELECT * FROM (
    SELECT m.id, m.status, m.home_id = uid,
      CASE WHEN m.home_id = uid THEN m.away_id ELSE m.home_id END,
      p.username,
      CASE WHEN m.home_id = uid THEN m.home_goals ELSE m.away_goals END,
      CASE WHEN m.home_id = uid THEN m.away_goals ELSE m.home_goals END,
      (m.status = 'pending' AND m.away_id = uid)
        OR (m.status = 'halftime' AND NOT EXISTS (SELECT 1 FROM public.match_halftime h WHERE h.match_id = m.id AND h.player_id = uid)),
      m.status = 'pending' AND m.away_id = uid,
      m.status = 'pending' AND m.away_id IS NULL,
      EXISTS (SELECT 1 FROM public.match_halftime h WHERE h.match_id = m.id
        AND h.player_id = CASE WHEN m.home_id = uid THEN m.away_id ELSE m.home_id END),
      CASE WHEN m.status <> 'finished' THEN NULL WHEN m.winner_id IS NULL THEN 'draw' WHEN m.winner_id = uid THEN 'win' ELSE 'loss' END,
      CASE WHEN m.home_id = uid THEN m.home_reward ELSE m.away_reward END,
      CASE WHEN m.home_id = uid THEN m.home_elo_delta ELSE m.away_elo_delta END,
      (CASE WHEN m.home_id = uid THEN m.home_team ELSE m.away_team END->>'general')::int,
      (CASE WHEN m.home_id = uid THEN m.away_team ELSE m.home_team END->>'general')::int,
      m.created_at, m.halftime_at, m.finished_at
    FROM public.matches m
    LEFT JOIN public.profiles p ON p.id = CASE WHEN m.home_id = uid THEN m.away_id ELSE m.home_id END
    WHERE (m.home_id = uid OR m.away_id = uid)
      AND (m.status IN ('pending', 'halftime') OR m.finished_at > now() - interval '14 days')
  ) x
  ORDER BY x.finished_at DESC NULLS FIRST, x.created_at DESC
  LIMIT 60;
END $$;

CREATE OR REPLACE FUNCTION public.get_open_matches()
RETURNS TABLE(match_id uuid, home_id uuid, home_name text, home_rating integer, home_general integer, formation text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.home_id, p.username, coalesce(s.rating, 1000), (m.home_team->>'general')::int, m.home_team->>'formation', m.created_at
  FROM public.matches m
  JOIN public.profiles p ON p.id = m.home_id
  LEFT JOIN public.match_stats s ON s.user_id = m.home_id
  WHERE m.status = 'pending' AND m.away_id IS NULL AND m.home_id <> auth.uid()
    AND m.created_at > now() - interval '48 hours'
  ORDER BY m.created_at DESC
  LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.get_match_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, username text, level integer, rating integer, wins integer, losses integer, draws integer,
  played integer, goals_for integer, goals_against integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, p.username, p.level, s.rating, s.wins, s.losses, s.draws, s.played, s.goals_for, s.goals_against
  FROM public.match_stats s JOIN public.profiles p ON p.id = s.user_id
  WHERE s.played > 0
  ORDER BY s.rating DESC, s.wins DESC
  LIMIT least(_limit, 100)
$$;

REVOKE EXECUTE ON FUNCTION public._mm_cards(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_rate(text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_sim_half(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_reward_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mm_second_half(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._settle_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_manager_team(text, text, uuid[], uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_halftime(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_match(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_open_matches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_manager_team(text, text, uuid[], uuid[]), public.create_match(uuid), public.accept_match(uuid),
  public.submit_halftime(uuid, text, jsonb), public.leave_match(uuid), public.get_match(uuid), public.get_my_matches(),
  public.get_open_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_leaderboard(integer) TO anon, authenticated;
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished', 'cancelled', 'declined')),
  themes text[] NOT NULL,
  round integer NOT NULL DEFAULT 0,
  challenger_score integer NOT NULL DEFAULT 0,
  opponent_score integer NOT NULL DEFAULT 0,
  challenger_played boolean NOT NULL DEFAULT false,
  opponent_played boolean NOT NULL DEFAULT false,
  rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_id uuid,
  forfeit boolean NOT NULL DEFAULT false,
  challenger_reward integer,
  opponent_reward integer,
  challenger_elo_delta integer,
  opponent_elo_delta integer,
  round_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duel participants and open invites readable" ON public.duels FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR (status = 'pending' AND opponent_id IS NULL));
CREATE INDEX duels_challenger_idx ON public.duels(challenger_id, status);
CREATE INDEX duels_opponent_idx ON public.duels(opponent_id, status);
CREATE INDEX duels_status_idx ON public.duels(status, round_started_at);

-- Decks and moves stay secret: only reachable through SECURITY DEFINER functions.
CREATE TABLE public.duel_decks (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  cards jsonb NOT NULL,
  PRIMARY KEY (duel_id, player_id)
);
GRANT ALL ON public.duel_decks TO service_role;
ALTER TABLE public.duel_decks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.duel_moves (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  round integer NOT NULL,
  player_id uuid NOT NULL,
  slot integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, round, player_id)
);
GRANT ALL ON public.duel_moves TO service_role;
ALTER TABLE public.duel_moves ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.duel_stats (
  user_id uuid PRIMARY KEY,
  rating integer NOT NULL DEFAULT 1000,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  played integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.duel_stats TO anon, authenticated;
GRANT ALL ON public.duel_stats TO service_role;
ALTER TABLE public.duel_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duel stats readable" ON public.duel_stats FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;

CREATE OR REPLACE FUNCTION public._duel_cost(_rarity text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _rarity WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 WHEN 'super_rare' THEN 4
    WHEN 'legendary' THEN 6 WHEN 'secret_legendary' THEN 8 ELSE 99 END
$$;

CREATE OR REPLACE FUNCTION public._duel_power(_pos text, _rarity text, _version text, _rating integer, _theme text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT _rating
    + CASE _rarity WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2 WHEN 'super_rare' THEN 3 WHEN 'legendary' THEN 4 WHEN 'secret_legendary' THEN 5 ELSE 0 END
    + CASE WHEN _version IN ('alt', 'shiny') THEN 2 ELSE 0 END
    + CASE
        WHEN upper(_pos) = 'CLUB' THEN 2
        WHEN _theme = 'libre' THEN 0
        WHEN _theme = 'gardien' THEN CASE WHEN upper(_pos) = 'G' THEN 6 ELSE -6 END
        WHEN upper(_pos) = 'G' THEN -6
        WHEN _theme = 'attaque' AND upper(_pos) IN ('BU', 'AD', 'AG', 'MOC') THEN 6
        WHEN _theme = 'milieu' AND upper(_pos) IN ('MC', 'MDC', 'MOC') THEN 6
        WHEN _theme = 'defense' AND upper(_pos) IN ('DC', 'DD', 'DG', 'MDC') THEN 6
        ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public._duel_payout(_score numeric, _forfeit boolean) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _score = 1 THEN 100 WHEN _forfeit THEN 0 WHEN _score = 0.5 THEN 40 ELSE 20 END
$$;

CREATE OR REPLACE FUNCTION public._duel_deck(_uid uuid, _ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deck jsonb; n integer; nc integer; total_cost integer; su integer;
BEGIN
  IF _ids IS NULL OR coalesce(array_length(_ids, 1), 0) <> 5 OR (SELECT count(DISTINCT x) FROM unnest(_ids) x) <> 5 THEN
    RAISE EXCEPTION 'Choisis exactement 5 cartes différentes';
  END IF;
  SELECT count(*), count(DISTINCT uc.card_id), coalesce(sum(public._duel_cost(c.rarity)), 0), count(*) FILTER (WHERE c.rarity = 'secret_ultimate')
    INTO n, nc, total_cost, su
    FROM public.user_cards uc JOIN public.cards c ON c.id = uc.card_id
    WHERE uc.id = ANY(_ids) AND uc.user_id = _uid;
  IF n <> 5 THEN RAISE EXCEPTION 'Ces cartes ne sont pas toutes dans ta collection'; END IF;
  IF su > 0 THEN RAISE EXCEPTION 'Une de ces cartes ne peut pas jouer en duel'; END IF;
  IF nc <> 5 THEN RAISE EXCEPTION 'Un même joueur ne peut pas être deux fois dans ton équipe'; END IF;
  IF total_cost > 20 THEN RAISE EXCEPTION 'Ton équipe dépasse le budget de 20 points'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
      'slot', u.ord - 1, 'user_card_id', uc.id, 'card_id', c.id, 'name', c.name, 'club', c.club,
      'nationality', c.nationality, 'pos', c.pos, 'rating', c.rating, 'rarity', c.rarity, 'version', uc.version,
      'image_url', CASE WHEN uc.version = 'alt' THEN coalesce(c.alt_image_url, c.image_url) ELSE c.image_url END,
      'used', false) ORDER BY u.ord)
    INTO deck
    FROM unnest(_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.user_cards uc ON uc.id = u.id
    JOIN public.cards c ON c.id = uc.card_id;
  RETURN deck;
END $$;

CREATE OR REPLACE FUNCTION public._duel_reward_ok(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) < 5 FROM public.duels
  WHERE status = 'finished' AND finished_at >= date_trunc('day', now())
    AND ((challenger_id = _uid AND challenger_reward > 0) OR (opponent_id = _uid AND opponent_reward > 0))
$$;

CREATE OR REPLACE FUNCTION public._finish_duel(_id uuid, _winner uuid, _forfeit boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.duels%rowtype; ra integer; rb integer; sa numeric; ea numeric; da integer;
  ca integer := 0; co integer := 0; xa integer; xo integer;
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR d.status <> 'active' THEN RETURN; END IF;
  INSERT INTO public.duel_stats (user_id) VALUES (d.challenger_id), (d.opponent_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT rating INTO ra FROM public.duel_stats WHERE user_id = d.challenger_id FOR UPDATE;
  SELECT rating INTO rb FROM public.duel_stats WHERE user_id = d.opponent_id FOR UPDATE;
  sa := CASE WHEN _winner = d.challenger_id THEN 1 WHEN _winner = d.opponent_id THEN 0 ELSE 0.5 END;
  ea := 1 / (1 + power(10::numeric, (rb - ra) / 400.0));
  da := round(32 * (sa - ea));
  IF public._duel_reward_ok(d.challenger_id) THEN ca := public._duel_payout(sa, _forfeit); END IF;
  IF public._duel_reward_ok(d.opponent_id) THEN co := public._duel_payout(1 - sa, _forfeit); END IF;
  xa := CASE ca WHEN 100 THEN 30 WHEN 40 THEN 15 WHEN 20 THEN 10 ELSE 0 END;
  xo := CASE co WHEN 100 THEN 30 WHEN 40 THEN 15 WHEN 20 THEN 10 ELSE 0 END;
  UPDATE public.profiles SET coins = coins + ca, xp = xp + xa, level = ((xp + xa) / 100) + 1 WHERE id = d.challenger_id;
  UPDATE public.profiles SET coins = coins + co, xp = xp + xo, level = ((xp + xo) / 100) + 1 WHERE id = d.opponent_id;
  UPDATE public.duel_stats SET rating = greatest(0, rating + da), wins = wins + (sa = 1)::int, losses = losses + (sa = 0)::int,
    draws = draws + (sa = 0.5)::int, played = played + 1, updated_at = now() WHERE user_id = d.challenger_id;
  UPDATE public.duel_stats SET rating = greatest(0, rating - da), wins = wins + (sa = 0)::int, losses = losses + (sa = 1)::int,
    draws = draws + (sa = 0.5)::int, played = played + 1, updated_at = now() WHERE user_id = d.opponent_id;
  UPDATE public.duels SET status = 'finished', winner_id = _winner, forfeit = _forfeit, challenger_reward = ca, opponent_reward = co,
    challenger_elo_delta = da, opponent_elo_delta = -da, challenger_played = false, opponent_played = false, finished_at = now()
    WHERE id = _id;
END $$;

-- Lazy timeouts (no cron): invitations expire after 48 h, a player who does not play a round within 24 h loses by forfeit.
CREATE OR REPLACE FUNCTION public._settle_duels() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  UPDATE public.duels SET status = 'cancelled', finished_at = now()
    WHERE status = 'pending' AND created_at < now() - interval '48 hours';
  FOR d IN SELECT * FROM public.duels WHERE status = 'active' AND round_started_at < now() - interval '24 hours' FOR UPDATE SKIP LOCKED LOOP
    IF d.challenger_played AND NOT d.opponent_played THEN
      PERFORM public._finish_duel(d.id, d.challenger_id, true);
    ELSIF d.opponent_played AND NOT d.challenger_played THEN
      PERFORM public._finish_duel(d.id, d.opponent_id, true);
    ELSE
      PERFORM public._finish_duel(d.id, CASE WHEN d.challenger_score > d.opponent_score THEN d.challenger_id
        WHEN d.opponent_score > d.challenger_score THEN d.opponent_id END, true);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_duel(_duel_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); d public.duels%rowtype; side text; mine jsonb; theirs jsonb; mv integer; cn text; opn text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_duels();
  SELECT * INTO d FROM public.duels WHERE id = _duel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  side := CASE WHEN uid = d.challenger_id THEN 'challenger' WHEN uid = d.opponent_id THEN 'opponent' END;
  IF side IS NULL AND NOT (d.status = 'pending' AND d.opponent_id IS NULL) THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  SELECT cards INTO mine FROM public.duel_decks WHERE duel_id = d.id AND player_id = uid;
  IF side IS NOT NULL AND d.status IN ('active', 'finished') THEN
    SELECT cards INTO theirs FROM public.duel_decks WHERE duel_id = d.id
      AND player_id = CASE WHEN side = 'challenger' THEN d.opponent_id ELSE d.challenger_id END;
  END IF;
  SELECT slot INTO mv FROM public.duel_moves WHERE duel_id = d.id AND round = d.round AND player_id = uid;
  SELECT username INTO cn FROM public.profiles WHERE id = d.challenger_id;
  SELECT username INTO opn FROM public.profiles WHERE id = d.opponent_id;
  RETURN jsonb_build_object(
    'id', d.id, 'status', d.status, 'themes', to_jsonb(d.themes), 'round', d.round, 'side', side,
    'challenger', jsonb_build_object('id', d.challenger_id, 'name', cn, 'score', d.challenger_score, 'played', d.challenger_played,
      'reward', d.challenger_reward, 'elo_delta', d.challenger_elo_delta),
    'opponent', jsonb_build_object('id', d.opponent_id, 'name', opn, 'score', d.opponent_score, 'played', d.opponent_played,
      'reward', d.opponent_reward, 'elo_delta', d.opponent_elo_delta),
    'my_deck', coalesce(mine, '[]'::jsonb), 'their_deck', coalesce(theirs, '[]'::jsonb), 'rounds', d.rounds, 'my_move', mv,
    'winner_id', d.winner_id, 'forfeit', d.forfeit, 'created_at', d.created_at, 'round_started_at', d.round_started_at,
    'finished_at', d.finished_at);
END $$;

CREATE OR REPLACE FUNCTION public.create_duel(_opponent uuid, _user_card_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); deck jsonb; did uuid; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_duels();
  IF _opponent = uid THEN RAISE EXCEPTION 'Tu ne peux pas te défier toi-même'; END IF;
  IF _opponent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _opponent) THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
  SELECT count(*) INTO n FROM public.duels WHERE status IN ('pending', 'active') AND (challenger_id = uid OR opponent_id = uid);
  IF n >= 10 THEN RAISE EXCEPTION 'Tu as déjà 10 duels en cours'; END IF;
  deck := public._duel_deck(uid, _user_card_ids);
  INSERT INTO public.duels (challenger_id, opponent_id, themes)
    VALUES (uid, _opponent, (SELECT array_agg(t ORDER BY random()) FROM unnest(ARRAY['attaque', 'milieu', 'defense', 'gardien', 'libre']) t))
    RETURNING id INTO did;
  INSERT INTO public.duel_decks (duel_id, player_id, cards) VALUES (did, uid, deck);
  RETURN did;
END $$;

CREATE OR REPLACE FUNCTION public.accept_duel(_duel_id uuid, _user_card_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.duels%rowtype; deck jsonb; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_duels();
  SELECT * INTO d FROM public.duels WHERE id = _duel_id FOR UPDATE;
  IF NOT FOUND OR d.status <> 'pending' OR (d.opponent_id IS NOT NULL AND d.opponent_id <> uid) THEN
    RAISE EXCEPTION 'Ce défi n''est plus disponible';
  END IF;
  IF d.challenger_id = uid THEN RAISE EXCEPTION 'Tu ne peux pas accepter ton propre défi'; END IF;
  SELECT count(*) INTO n FROM public.duels WHERE status IN ('pending', 'active') AND id <> d.id AND (challenger_id = uid OR opponent_id = uid);
  IF n >= 10 THEN RAISE EXCEPTION 'Tu as déjà 10 duels en cours'; END IF;
  deck := public._duel_deck(uid, _user_card_ids);
  INSERT INTO public.duel_decks (duel_id, player_id, cards) VALUES (d.id, uid, deck);
  UPDATE public.duels SET opponent_id = uid, status = 'active', round_started_at = now() WHERE id = d.id;
  RETURN d.id;
END $$;

-- Pending: the challenger cancels or the invited player declines. Active: the caller gives up and loses by forfeit.
CREATE OR REPLACE FUNCTION public.leave_duel(_duel_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.duels%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO d FROM public.duels WHERE id = _duel_id FOR UPDATE;
  IF NOT FOUND OR (uid <> d.challenger_id AND uid IS DISTINCT FROM d.opponent_id) THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  IF d.status = 'pending' THEN
    UPDATE public.duels SET status = CASE WHEN uid = d.challenger_id THEN 'cancelled' ELSE 'declined' END, finished_at = now() WHERE id = d.id;
  ELSIF d.status = 'active' THEN
    PERFORM public._finish_duel(d.id, CASE WHEN uid = d.challenger_id THEN d.opponent_id ELSE d.challenger_id END, true);
  ELSE
    RAISE EXCEPTION 'Ce duel est déjà terminé';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.play_card(_duel_id uuid, _slot integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); d public.duels%rowtype; side text; deck jsonb; theme text;
  cdeck jsonb; odeck jsonb; cs integer; os integer; cc jsonb; oc jsonb; pc integer; po integer; w text; remaining integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_duels();
  SELECT * INTO d FROM public.duels WHERE id = _duel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  side := CASE WHEN uid = d.challenger_id THEN 'challenger' WHEN uid = d.opponent_id THEN 'opponent' END;
  IF side IS NULL THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  IF d.status <> 'active' THEN RAISE EXCEPTION 'Ce duel n''est pas en cours'; END IF;
  IF (side = 'challenger' AND d.challenger_played) OR (side = 'opponent' AND d.opponent_played) THEN
    RAISE EXCEPTION 'Tu as déjà joué cette manche';
  END IF;
  SELECT cards INTO deck FROM public.duel_decks WHERE duel_id = d.id AND player_id = uid;
  IF _slot IS NULL OR _slot < 0 OR _slot > 4 OR (deck->_slot->>'used')::boolean THEN RAISE EXCEPTION 'Carte indisponible'; END IF;
  INSERT INTO public.duel_moves (duel_id, round, player_id, slot) VALUES (d.id, d.round, uid, _slot);
  IF side = 'challenger' THEN
    UPDATE public.duels SET challenger_played = true WHERE id = d.id RETURNING * INTO d;
  ELSE
    UPDATE public.duels SET opponent_played = true WHERE id = d.id RETURNING * INTO d;
  END IF;

  IF d.challenger_played AND d.opponent_played THEN
    theme := d.themes[d.round + 1];
    SELECT cards INTO cdeck FROM public.duel_decks WHERE duel_id = d.id AND player_id = d.challenger_id;
    SELECT cards INTO odeck FROM public.duel_decks WHERE duel_id = d.id AND player_id = d.opponent_id;
    SELECT slot INTO cs FROM public.duel_moves WHERE duel_id = d.id AND round = d.round AND player_id = d.challenger_id;
    SELECT slot INTO os FROM public.duel_moves WHERE duel_id = d.id AND round = d.round AND player_id = d.opponent_id;
    cc := cdeck->cs; oc := odeck->os;
    pc := public._duel_power(cc->>'pos', cc->>'rarity', cc->>'version', (cc->>'rating')::int, theme);
    po := public._duel_power(oc->>'pos', oc->>'rarity', oc->>'version', (oc->>'rating')::int, theme);
    w := CASE WHEN pc > po THEN 'challenger' WHEN po > pc THEN 'opponent' END;
    UPDATE public.duel_decks SET cards = jsonb_set(cards, ARRAY[cs::text, 'used'], 'true'::jsonb) WHERE duel_id = d.id AND player_id = d.challenger_id;
    UPDATE public.duel_decks SET cards = jsonb_set(cards, ARRAY[os::text, 'used'], 'true'::jsonb) WHERE duel_id = d.id AND player_id = d.opponent_id;
    UPDATE public.duels SET
      rounds = rounds || jsonb_build_array(jsonb_build_object('round', d.round + 1, 'theme', theme,
        'challenger', cc || jsonb_build_object('power', pc), 'opponent', oc || jsonb_build_object('power', po), 'winner', w)),
      challenger_score = challenger_score + CASE WHEN w = 'challenger' THEN 1 ELSE 0 END,
      opponent_score = opponent_score + CASE WHEN w = 'opponent' THEN 1 ELSE 0 END,
      round = round + 1, challenger_played = false, opponent_played = false, round_started_at = now()
      WHERE id = d.id RETURNING * INTO d;
    remaining := 5 - d.round;
    IF remaining = 0 OR abs(d.challenger_score - d.opponent_score) > remaining THEN
      PERFORM public._finish_duel(d.id, CASE WHEN d.challenger_score > d.opponent_score THEN d.challenger_id
        WHEN d.opponent_score > d.challenger_score THEN d.opponent_id END, false);
    END IF;
  END IF;
  RETURN public.get_duel(d.id);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_duels()
RETURNS TABLE(duel_id uuid, status text, is_challenger boolean, opponent_id uuid, opponent_name text, my_score integer,
  their_score integer, round integer, my_turn boolean, they_played boolean, incoming boolean, open_invite boolean,
  result text, forfeit boolean, my_reward integer, my_elo_delta integer, created_at timestamptz, finished_at timestamptz,
  round_started_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  PERFORM public._settle_duels();
  RETURN QUERY
  SELECT * FROM (
    SELECT d.id, d.status, d.challenger_id = uid,
      CASE WHEN d.challenger_id = uid THEN d.opponent_id ELSE d.challenger_id END,
      p.username,
      CASE WHEN d.challenger_id = uid THEN d.challenger_score ELSE d.opponent_score END,
      CASE WHEN d.challenger_id = uid THEN d.opponent_score ELSE d.challenger_score END,
      d.round,
      d.status = 'active' AND NOT CASE WHEN d.challenger_id = uid THEN d.challenger_played ELSE d.opponent_played END,
      CASE WHEN d.challenger_id = uid THEN d.opponent_played ELSE d.challenger_played END,
      d.status = 'pending' AND d.opponent_id = uid,
      d.status = 'pending' AND d.opponent_id IS NULL,
      CASE WHEN d.status <> 'finished' THEN NULL WHEN d.winner_id IS NULL THEN 'draw' WHEN d.winner_id = uid THEN 'win' ELSE 'loss' END,
      d.forfeit,
      CASE WHEN d.challenger_id = uid THEN d.challenger_reward ELSE d.opponent_reward END,
      CASE WHEN d.challenger_id = uid THEN d.challenger_elo_delta ELSE d.opponent_elo_delta END,
      d.created_at, d.finished_at, d.round_started_at
    FROM public.duels d
    LEFT JOIN public.profiles p ON p.id = CASE WHEN d.challenger_id = uid THEN d.opponent_id ELSE d.challenger_id END
    WHERE (d.challenger_id = uid OR d.opponent_id = uid)
      AND (d.status IN ('pending', 'active') OR d.finished_at > now() - interval '14 days')
  ) x
  ORDER BY x.finished_at DESC NULLS FIRST, x.created_at DESC
  LIMIT 60;
END $$;

CREATE OR REPLACE FUNCTION public.get_open_duels()
RETURNS TABLE(duel_id uuid, challenger_id uuid, challenger_name text, challenger_rating integer, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.challenger_id, p.username, coalesce(s.rating, 1000), d.created_at
  FROM public.duels d
  JOIN public.profiles p ON p.id = d.challenger_id
  LEFT JOIN public.duel_stats s ON s.user_id = d.challenger_id
  WHERE d.status = 'pending' AND d.opponent_id IS NULL AND d.challenger_id <> auth.uid()
    AND d.created_at > now() - interval '48 hours'
  ORDER BY d.created_at DESC
  LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.get_duel_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, username text, level integer, rating integer, wins integer, losses integer, draws integer, played integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, p.username, p.level, s.rating, s.wins, s.losses, s.draws, s.played
  FROM public.duel_stats s JOIN public.profiles p ON p.id = s.user_id
  WHERE s.played > 0
  ORDER BY s.rating DESC, s.wins DESC
  LIMIT least(_limit, 100)
$$;

REVOKE EXECUTE ON FUNCTION public._duel_deck(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._duel_reward_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._finish_duel(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._settle_duels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_duel(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_duel(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_duel(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_duel(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.play_card(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_duels() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_open_duels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_duel(uuid), public.create_duel(uuid, uuid[]), public.accept_duel(uuid, uuid[]),
  public.leave_duel(uuid), public.play_card(uuid, integer), public.get_my_duels(), public.get_open_duels() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duel_leaderboard(integer) TO anon, authenticated;
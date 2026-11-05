CREATE TABLE public.quiz_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'live',
  score integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  answered integer NOT NULL DEFAULT 0,
  cur_answer text,
  cur_points integer,
  cur_rarity text
);
CREATE INDEX quiz_runs_user_idx ON public.quiz_runs (user_id, started_at DESC);
CREATE INDEX quiz_runs_started_idx ON public.quiz_runs (started_at);
GRANT ALL ON public.quiz_runs TO service_role;
ALTER TABLE public.quiz_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._quiz_pos(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN upper(p) = 'G' THEN 'Gardien'
    WHEN upper(p) IN ('DD','DG','DC') THEN 'Défenseur'
    WHEN upper(p) IN ('MDC','MC','MOC') THEN 'Milieu'
    ELSE 'Attaquant' END $$;

CREATE OR REPLACE FUNCTION public._quiz_trivia() RETURNS TABLE(q text, a text, w text[]) LANGUAGE sql IMMUTABLE AS $$
  VALUES
  ('Qui a gagné la Coupe du monde 2022 ?', 'Argentine', ARRAY['France','Croatie','Maroc']),
  ('Qui a gagné la Coupe du monde 2018 ?', 'France', ARRAY['Croatie','Belgique','Angleterre']),
  ('Qui a gagné la Coupe du monde 2014 ?', 'Allemagne', ARRAY['Argentine','Brésil','Pays-Bas']),
  ('Qui a gagné la Coupe du monde 2010 ?', 'Espagne', ARRAY['Pays-Bas','Allemagne','Uruguay']),
  ('Qui a gagné la Coupe du monde 1998 ?', 'France', ARRAY['Brésil','Croatie','Pays-Bas']),
  ('Qui a gagné la toute première Coupe du monde en 1930 ?', 'Uruguay', ARRAY['Argentine','Italie','Brésil']),
  ('Quel pays a organisé la Coupe du monde 2022 ?', 'Qatar', ARRAY['Russie','Arabie saoudite','Émirats arabes unis']),
  ('Quel pays compte le plus de Coupes du monde ?', 'Brésil', ARRAY['Allemagne','Italie','Argentine']),
  ('Qui a gagné l''Euro 2024 ?', 'Espagne', ARRAY['Angleterre','France','Pays-Bas']),
  ('Qui a gagné l''Euro 2020 ?', 'Italie', ARRAY['Angleterre','Espagne','Danemark']),
  ('Qui a gagné l''Euro 2016 ?', 'Portugal', ARRAY['France','Allemagne','Pays de Galles']),
  ('Qui a gagné la Copa América 2024 ?', 'Argentine', ARRAY['Colombie','Uruguay','Brésil']),
  ('Qui a gagné la CAN disputée en 2024 ?', 'Côte d''Ivoire', ARRAY['Nigeria','Sénégal','Égypte']),
  ('Quel club a gagné la Ligue des champions 2025 ?', 'Paris Saint-Germain', ARRAY['Inter Milan','Arsenal','FC Barcelone']),
  ('Quel club a gagné la Ligue des champions 2024 ?', 'Real Madrid', ARRAY['Borussia Dortmund','Bayern Munich','Paris Saint-Germain']),
  ('Quel club a gagné la Ligue des champions 2023 ?', 'Manchester City', ARRAY['Inter Milan','Real Madrid','AC Milan']),
  ('Quel club compte le plus de Ligues des champions ?', 'Real Madrid', ARRAY['AC Milan','Bayern Munich','Liverpool']),
  ('Qui a gagné le Ballon d''Or 2025 ?', 'Ousmane Dembélé', ARRAY['Lamine Yamal','Vitinha','Raphinha']),
  ('Qui a gagné le Ballon d''Or 2024 ?', 'Rodri', ARRAY['Vinícius Júnior','Jude Bellingham','Harry Kane']),
  ('Qui a gagné le Ballon d''Or 2023 ?', 'Lionel Messi', ARRAY['Erling Haaland','Kylian Mbappé','Kevin De Bruyne']),
  ('Qui détient le record de Ballons d''Or ?', 'Lionel Messi', ARRAY['Cristiano Ronaldo','Michel Platini','Johan Cruyff']),
  ('Qui est le meilleur buteur de l''histoire de la Coupe du monde ?', 'Miroslav Klose', ARRAY['Ronaldo','Gerd Müller','Just Fontaine']),
  ('Qui a marqué 13 buts lors d''une seule Coupe du monde (1958) ?', 'Just Fontaine', ARRAY['Pelé','Gerd Müller','Eusébio']),
  ('Combien de joueurs par équipe sur le terrain ?', '11', ARRAY['10','12','9']),
  ('Combien de minutes dure un match sans prolongation ?', '90', ARRAY['80','100','120']),
  ('À quelle distance du but est le point de penalty ?', '11 mètres', ARRAY['9 mètres','12 mètres','16 mètres']),
  ('Quelle couleur de carton signifie une expulsion ?', 'Rouge', ARRAY['Jaune','Bleu','Blanc']),
  ('Quel est le surnom de l''équipe de Belgique ?', 'Les Diables rouges', ARRAY['Les Bleus','La Roja','Les Lions']),
  ('Quel est le surnom de l''équipe d''Espagne ?', 'La Roja', ARRAY['La Albiceleste','Les Diables rouges','La Seleção']),
  ('Quel est le surnom de l''équipe d''Argentine ?', 'La Albiceleste', ARRAY['La Roja','La Seleção','La Celeste']),
  ('Quel est le surnom de l''équipe de France ?', 'Les Bleus', ARRAY['Les Diables rouges','La Roja','Les Lions']),
  ('Quel est le stade du PSG ?', 'Parc des Princes', ARRAY['Vélodrome','Stade de France','Allianz Riviera']),
  ('Quel est le stade de l''OM ?', 'Vélodrome', ARRAY['Parc des Princes','Groupama Stadium','Stade Bollaert']),
  ('Quel est le stade du FC Barcelone ?', 'Camp Nou', ARRAY['Santiago Bernabéu','Metropolitano','Mestalla']),
  ('Quel est le stade du Real Madrid ?', 'Santiago Bernabéu', ARRAY['Camp Nou','Metropolitano','San Siro']),
  ('Quel est le stade de Manchester United ?', 'Old Trafford', ARRAY['Anfield','Etihad Stadium','Emirates Stadium']),
  ('Quel est le stade de Liverpool ?', 'Anfield', ARRAY['Old Trafford','Goodison Park','Stamford Bridge']),
  ('Qui était sélectionneur de la France championne du monde 1998 ?', 'Aimé Jacquet', ARRAY['Didier Deschamps','Roger Lemerre','Raymond Domenech']),
  ('Qui a été champion du monde comme joueur (1998) et sélectionneur (2018) ?', 'Didier Deschamps', ARRAY['Zinédine Zidane','Laurent Blanc','Lilian Thuram']),
  ('Qui a marqué deux buts de la tête en finale de la Coupe du monde 1998 ?', 'Zinédine Zidane', ARRAY['Thierry Henry','Emmanuel Petit','Youri Djorkaeff']),
  ('Dans quel club Kylian Mbappé a-t-il débuté chez les pros ?', 'AS Monaco', ARRAY['Paris Saint-Germain','Real Madrid','Lille']),
  ('Quel club Kylian Mbappé a-t-il rejoint en 2024 ?', 'Real Madrid', ARRAY['Liverpool','FC Barcelone','Manchester City']),
  ('De quel pays est Erling Haaland ?', 'Norvège', ARRAY['Suède','Danemark','Islande']),
  ('De quel pays est Pelé ?', 'Brésil', ARRAY['Argentine','Portugal','Uruguay']),
  ('Quel club a gagné la Premier League 2024-2025 ?', 'Liverpool', ARRAY['Arsenal','Manchester City','Chelsea']),
  ('Quel club a le plus de titres de champion de France ?', 'Paris Saint-Germain', ARRAY['AS Saint-Étienne','Olympique de Marseille','AS Monaco']),
  ('Que veut dire VAR ?', 'Assistance vidéo à l''arbitrage', ARRAY['Vitesse arbitre rapide','Vérification après rencontre','Vote des arbitres réunis']),
  ('Quelle sélection Lionel Messi représente-t-il ?', 'Argentine', ARRAY['Espagne','Uruguay','Chili']),
  ('Quelle sélection Cristiano Ronaldo représente-t-il ?', 'Portugal', ARRAY['Brésil','Espagne','Italie']),
  ('Quels pays organisent la Coupe du monde 2026 ?', 'États-Unis, Canada et Mexique', ARRAY['Espagne, Portugal et Maroc','Arabie saoudite','Brésil et Argentine'])
$$;

CREATE OR REPLACE FUNCTION public._quiz_question(_d numeric) RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  c record; t record; kind int; n int; close boolean := _d < 0.4;
  ans text; prompt text; wrong text[] := '{}'; opts text[];
BEGIN
  n := CASE WHEN _d < 0.75 THEN 4 WHEN _d < 0.95 THEN 3 ELSE 2 END;
  kind := floor(random() * (CASE WHEN close THEN 7 ELSE 6 END))::int;
  IF kind = 5 THEN
    SELECT * INTO t FROM public._quiz_trivia() ORDER BY random() LIMIT 1;
    RETURN jsonb_build_object('prompt', t.q, 'answer', t.a,
      'options', (SELECT jsonb_agg(x ORDER BY random()) FROM unnest(t.w[1:n-1] || t.a) x));
  END IF;
  SELECT ca.id, ca.name, ca.club, ca.nationality, ca.pos, ca.rating INTO c FROM public.cards ca
    WHERE ca.active AND ca.rarity <> 'secret_ultimate' AND ca.pos <> 'CLUB' AND coalesce(ca.club,'') <> ''
    ORDER BY random() LIMIT 1;
  IF kind IN (0, 4) THEN
    prompt := format('Dans quel club joue %s ?', c.name); ans := c.club;
    IF close THEN
      wrong := ARRAY(SELECT x FROM (SELECT DISTINCT ca.club x FROM public.cards ca WHERE ca.active AND ca.pos <> 'CLUB'
        AND abs(ca.rating - c.rating) <= 3 AND ca.club NOT IN (SELECT club FROM public.cards WHERE name = c.name)) s ORDER BY random() LIMIT n-1);
    END IF;
    IF cardinality(wrong) < n-1 THEN
      wrong := wrong || ARRAY(SELECT x FROM (SELECT DISTINCT ca.club x FROM public.cards ca WHERE ca.active AND ca.pos <> 'CLUB'
        AND ca.club NOT IN (SELECT club FROM public.cards WHERE name = c.name) AND NOT (ca.club = ANY(wrong))) s ORDER BY random() LIMIT n-1-cardinality(wrong));
    END IF;
  ELSIF kind = 1 THEN
    prompt := format('Quelle est la nationalité de %s ?', c.name); ans := c.nationality;
    IF close THEN
      wrong := ARRAY(SELECT x FROM (SELECT DISTINCT ca.nationality x FROM public.cards ca WHERE ca.active AND ca.club = c.club
        AND ca.nationality NOT IN (SELECT nationality FROM public.cards WHERE name = c.name)) s ORDER BY random() LIMIT n-1);
    END IF;
    IF cardinality(wrong) < n-1 THEN
      wrong := wrong || ARRAY(SELECT x FROM (SELECT DISTINCT ca.nationality x FROM public.cards ca WHERE ca.active
        AND ca.nationality NOT IN (SELECT nationality FROM public.cards WHERE name = c.name) AND NOT (ca.nationality = ANY(wrong))) s ORDER BY random() LIMIT n-1-cardinality(wrong));
    END IF;
  ELSIF kind = 2 THEN
    prompt := format('À quel poste joue %s ?', c.name); ans := public._quiz_pos(c.pos);
    wrong := ARRAY(SELECT x FROM unnest(ARRAY['Gardien','Défenseur','Milieu','Attaquant']) x
      WHERE x NOT IN (SELECT public._quiz_pos(pos) FROM public.cards WHERE name = c.name) ORDER BY random() LIMIT n-1);
  ELSIF kind = 3 THEN
    prompt := format('Lequel de ces joueurs joue à %s ?', c.club); ans := c.name;
    IF close THEN
      wrong := ARRAY(SELECT x FROM (SELECT DISTINCT ca.name x FROM public.cards ca WHERE ca.active AND ca.pos <> 'CLUB'
        AND ca.nationality = c.nationality AND ca.name NOT IN (SELECT name FROM public.cards WHERE club = c.club)) s ORDER BY random() LIMIT n-1);
    END IF;
    IF cardinality(wrong) < n-1 THEN
      wrong := wrong || ARRAY(SELECT x FROM (SELECT DISTINCT ca.name x FROM public.cards ca WHERE ca.active AND ca.pos <> 'CLUB'
        AND ca.name NOT IN (SELECT name FROM public.cards WHERE club = c.club) AND NOT (ca.name = ANY(wrong))) s ORDER BY random() LIMIT n-1-cardinality(wrong));
    END IF;
  ELSE
    prompt := format('Quelle est la note de %s dans Goalmaster ?', c.name); ans := c.rating::text;
    wrong := ARRAY(SELECT x::text FROM generate_series(c.rating - 4, c.rating + 4) x
      WHERE x NOT IN (SELECT rating FROM public.cards WHERE name = c.name) ORDER BY random() LIMIT n-1);
  END IF;
  opts := ARRAY(SELECT x FROM unnest(wrong || ans) x ORDER BY random());
  RETURN jsonb_build_object('prompt', prompt, 'answer', ans, 'options', to_jsonb(opts));
END $$;

CREATE OR REPLACE FUNCTION public._quiz_next(_run uuid, _number int) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE rates jsonb; rk text; pos int; cnt int; d numeric; pts int; q jsonb; lbl text; col text;
BEGIN
  SELECT slot_rates - 'secret_ultimate' INTO rates FROM public.pack_types WHERE key = 'classic';
  IF rates IS NULL THEN SELECT slot_rates - 'secret_ultimate' INTO rates FROM public.pack_types WHERE active ORDER BY sort_order LIMIT 1; END IF;
  rk := public._draw_key(rates);
  SELECT count(*) INTO cnt FROM public.rarities r WHERE rates ? r.key AND r.active;
  SELECT count(*) INTO pos FROM public.rarities r, public.rarities me
    WHERE me.key = rk AND rates ? r.key AND r.active AND r.rank < me.rank;
  d := CASE WHEN cnt > 1 THEN pos::numeric / (cnt - 1) ELSE 0 END;
  pts := 10 - round(8 * d)::int;
  q := public._quiz_question(d);
  SELECT label, color INTO lbl, col FROM public.rarities WHERE key = rk;
  UPDATE public.quiz_runs SET cur_answer = q->>'answer', cur_points = pts, cur_rarity = rk WHERE id = _run;
  RETURN jsonb_build_object('number', _number, 'prompt', q->>'prompt', 'options', q->'options',
    'rarity', rk, 'label', coalesce(lbl, rk), 'color', col, 'points', pts);
END $$;

CREATE OR REPLACE FUNCTION public.start_quiz() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid; e timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi pour jouer'; END IF;
  UPDATE public.quiz_runs SET status = 'done' WHERE user_id = uid AND status = 'live';
  INSERT INTO public.quiz_runs (user_id, ends_at) VALUES (uid, now() + interval '40 seconds') RETURNING id, ends_at INTO rid, e;
  RETURN jsonb_build_object('run_id', rid, 'ends_at', e, 'server_now', now(), 'question', public._quiz_next(rid, 1));
END $$;

CREATE OR REPLACE FUNCTION public._quiz_result(_r public.quiz_runs) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('finished', true, 'score', _r.score, 'correct', _r.correct, 'answered', _r.answered,
    'best', (SELECT max(score) FROM public.quiz_runs WHERE user_id = _r.user_id))
$$;

CREATE OR REPLACE FUNCTION public.answer_quiz(_run uuid, _choice text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.quiz_runs; ok boolean; gained int := 0; was text;
BEGIN
  SELECT * INTO r FROM public.quiz_runs WHERE id = _run AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partie introuvable'; END IF;
  IF r.status <> 'live' THEN RETURN public._quiz_result(r); END IF;
  IF now() > r.ends_at + interval '2 seconds' THEN
    UPDATE public.quiz_runs SET status = 'done', cur_answer = NULL WHERE id = _run RETURNING * INTO r;
    RETURN public._quiz_result(r);
  END IF;
  was := r.cur_answer;
  ok := _choice IS NOT NULL AND _choice = was;
  IF ok THEN gained := coalesce(r.cur_points, 0); END IF;
  UPDATE public.quiz_runs SET score = score + gained, correct = correct + ok::int, answered = answered + 1,
    status = CASE WHEN now() >= ends_at THEN 'done' ELSE status END
    WHERE id = _run RETURNING * INTO r;
  IF r.status = 'done' THEN
    RETURN public._quiz_result(r) || jsonb_build_object('was_correct', ok, 'answer', was, 'gained', gained);
  END IF;
  RETURN jsonb_build_object('finished', false, 'was_correct', ok, 'answer', was, 'gained', gained,
    'score', r.score, 'correct', r.correct, 'answered', r.answered, 'question', public._quiz_next(_run, r.answered + 1));
END $$;

CREATE OR REPLACE FUNCTION public.finish_quiz(_run uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.quiz_runs;
BEGIN
  UPDATE public.quiz_runs SET status = 'done', cur_answer = NULL WHERE id = _run AND user_id = auth.uid() RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partie introuvable'; END IF;
  RETURN public._quiz_result(r);
END $$;

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(_period text DEFAULT 'week')
RETURNS TABLE(user_id uuid, username text, avatar_url text, best integer, total bigint, runs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.user_id, p.username, p.avatar_url, max(q.score)::int, sum(q.score)::bigint, count(*)::bigint
  FROM public.quiz_runs q JOIN public.profiles p ON p.id = q.user_id
  WHERE q.answered > 0 AND (_period <> 'week' OR q.started_at >= (date_trunc('week', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'))
  GROUP BY q.user_id, p.username, p.avatar_url
  ORDER BY max(q.score) DESC, sum(q.score) DESC
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public._quiz_question(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._quiz_next(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._quiz_trivia() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._quiz_result(public.quiz_runs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_quiz() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_quiz(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_quiz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz(), public.answer_quiz(uuid, text), public.finish_quiz(uuid), public.get_quiz_leaderboard(text) TO authenticated;

DROP FUNCTION public.admin_player_stats(numeric);
CREATE FUNCTION public.admin_player_stats(_min_rank numeric DEFAULT 3)
 RETURNS TABLE(user_id uuid, username text, level integer, xp integer, coins integer, joined_at timestamp with time zone, is_admin boolean, packs_opened bigint, cards_pulled bigint, rare_pulled bigint, legendary_pulled bigint, cards_owned bigint, unique_owned bigint, rare_owned bigint, duel_wins integer, duel_losses integer, duel_draws integer, duel_rating integer, tactic_wins integer, tactic_losses integer, tactic_draws integer, goals_for integer, goals_against integer, match_rating integer, live_wins bigint, live_losses bigint, live_draws bigint, auctions_sold bigint, ballon_dor bigint, challenges_claimed bigint, quiz_points bigint, quiz_best integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  legend_rank numeric := coalesce((select rank from public.rarities where key = 'legendary'), 5);
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  return query
  with pulls as (
    select po.user_id as uid, count(distinct po.id) as packs, count(r.x) as pulled,
      count(r.x) filter (where coalesce(ra.rank, (r.x->>'rank')::numeric, 0) >= _min_rank) as rare,
      count(r.x) filter (where coalesce(ra.rank, (r.x->>'rank')::numeric, 0) >= legend_rank) as legend
    from public.pack_openings po
    cross join lateral jsonb_array_elements(po.results) as r(x)
    left join public.rarities ra on ra.key = r.x->>'rarity'
    group by po.user_id
  ), owned as (
    select uc.user_id as uid, count(*) as total, count(distinct (uc.card_id, uc.version)) as uniq,
      count(*) filter (where coalesce(ra.rank, 0) >= _min_rank) as rare
    from public.user_cards uc
    join public.cards c on c.id = uc.card_id
    left join public.rarities ra on ra.key = c.rarity
    group by uc.user_id
  ), live as (
    select s.uid,
      count(*) filter (where lm.winner_id = s.uid) as w,
      count(*) filter (where lm.result is distinct from 'draw' and lm.winner_id is distinct from s.uid) as l,
      count(*) filter (where lm.result = 'draw') as d
    from public.live_matches lm
    cross join lateral (values (lm.home_id), (lm.away_id)) as s(uid)
    where lm.status = 'finished' and s.uid is not null
    group by s.uid
  ), sold as (
    select a.seller_id as uid, count(*) as n from public.auctions a where a.status = 'sold' group by a.seller_id
  ), bdo as (
    select b.winner_id as uid, count(*) as n from public.ballon_dor_ceremonies b where b.status = 'finished' and b.winner_id is not null group by b.winner_id
  ), ch as (
    select x.uid, count(*) as n from (
      select cc.user_id as uid from public.challenge_claims cc
      union all select pc.user_id from public.periodic_challenge_claims pc
    ) x group by x.uid
  ), qz as (
    select q.user_id as uid, sum(q.score) as pts, max(q.score) as best from public.quiz_runs q group by q.user_id
  )
  select p.id, p.username, p.level, p.xp, p.coins, p.created_at, public.has_role(p.id, 'admin'),
    coalesce(pu.packs, 0), coalesce(pu.pulled, 0), coalesce(pu.rare, 0), coalesce(pu.legend, 0),
    coalesce(o.total, 0), coalesce(o.uniq, 0), coalesce(o.rare, 0),
    coalesce(ds.wins, 0), coalesce(ds.losses, 0), coalesce(ds.draws, 0), coalesce(ds.rating, 1000),
    coalesce(ms.wins, 0), coalesce(ms.losses, 0), coalesce(ms.draws, 0), coalesce(ms.goals_for, 0), coalesce(ms.goals_against, 0), coalesce(ms.rating, 1000),
    coalesce(lv.w, 0), coalesce(lv.l, 0), coalesce(lv.d, 0),
    coalesce(so.n, 0), coalesce(bd.n, 0), coalesce(ch.n, 0),
    coalesce(qz.pts, 0)::bigint, coalesce(qz.best, 0)::int
  from public.profiles p
  left join pulls pu on pu.uid = p.id
  left join owned o on o.uid = p.id
  left join public.duel_stats ds on ds.user_id = p.id
  left join public.match_stats ms on ms.user_id = p.id
  left join live lv on lv.uid = p.id
  left join sold so on so.uid = p.id
  left join bdo bd on bd.uid = p.id
  left join ch on ch.uid = p.id
  left join qz on qz.uid = p.id
  order by p.username;
end $function$;
REVOKE ALL ON FUNCTION public.admin_player_stats(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_player_stats(numeric) TO authenticated;
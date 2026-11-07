CREATE OR REPLACE FUNCTION public._quiz_visual_question(_d numeric, _format text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; candidates jsonb; items jsonb; ans text; n int; opts jsonb;
BEGIN
  n := CASE WHEN _d < 0.75 THEN 4 WHEN _d < 0.95 THEN 3 ELSE 2 END;
  SELECT ca.id, ca.name, ca.nationality, ca.pos, ca.rating, ca.image_url INTO c FROM public.cards ca
    WHERE ca.active AND upper(ca.pos) <> 'CLUB' AND ca.rarity <> 'secret_ultimate'
      AND public._rarity_fx(ca.rarity) <> 'secret_ultimate' AND coalesce(ca.image_url, '') <> ''
    ORDER BY (ca.rating >= 60 + round(25 * _d)) DESC, random() LIMIT 1;
  IF NOT FOUND THEN RETURN public._quiz_question(_d) || jsonb_build_object('format', 'text'); END IF;
  SELECT jsonb_agg(jsonb_build_object('name', x.name, 'image_url', x.image_url)) INTO candidates FROM (
    SELECT DISTINCT ON (ca.name) ca.name, ca.image_url, ca.rating, ca.nationality, ca.pos
    FROM public.cards ca WHERE ca.active AND upper(ca.pos) <> 'CLUB'
      AND ca.rarity <> 'secret_ultimate' AND public._rarity_fx(ca.rarity) <> 'secret_ultimate'
      AND ca.name <> c.name AND coalesce(ca.image_url, '') <> '' AND ca.image_url <> c.image_url
    ORDER BY ca.name, ca.rating DESC
  ) x;
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO items FROM (
    SELECT e AS x FROM jsonb_array_elements(coalesce(candidates, '[]'::jsonb)) e
    ORDER BY CASE WHEN _d < 0.4 THEN abs((SELECT max(rating) FROM public.cards WHERE name = e->>'name') - c.rating) ELSE 0 END, random() LIMIT n - 1
  ) s;
  items := items || jsonb_build_array(jsonb_build_object('name', c.name, 'image_url', c.image_url));
  IF _format = 'photo_words' THEN
    SELECT jsonb_agg(e->>'name' ORDER BY random()) INTO opts FROM jsonb_array_elements(items) e;
    RETURN jsonb_build_object('format', _format, 'prompt', 'Quel nom correspond à ce joueur ?', 'image_url', c.image_url, 'options', opts, 'answer', c.name);
  END IF;
  SELECT jsonb_agg(jsonb_build_object('value', gen_random_uuid()::text, 'name', e->>'name', 'image_url', e->>'image_url') ORDER BY random()) INTO items FROM jsonb_array_elements(items) e;
  SELECT e->>'value' INTO ans FROM jsonb_array_elements(items) e WHERE e->>'name' = c.name;
  RETURN jsonb_build_object('format', 'image_choice', 'prompt', format('Quelle photo représente %s ?', c.name),
    'answer', ans, 'options', (SELECT jsonb_agg(e->>'value') FROM jsonb_array_elements(items) e),
    'image_options', (SELECT jsonb_agg(e - 'name') FROM jsonb_array_elements(items) e));
END $$;
REVOKE ALL ON FUNCTION public._quiz_visual_question(numeric, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._quiz_next(_run uuid, _number int) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE rates jsonb; rk text; pos int; cnt int; d numeric; pts int; q jsonb; lbl text; col text; fmt text;
BEGIN
  SELECT slot_rates - 'secret_ultimate' INTO rates FROM public.pack_types WHERE key = 'classic';
  IF rates IS NULL THEN SELECT slot_rates - 'secret_ultimate' INTO rates FROM public.pack_types WHERE active ORDER BY sort_order LIMIT 1; END IF;
  rk := public._draw_key(rates);
  SELECT count(*) INTO cnt FROM public.rarities r WHERE rates ? r.key AND r.active;
  SELECT count(*) INTO pos FROM public.rarities r, public.rarities me WHERE me.key = rk AND rates ? r.key AND r.active AND r.rank < me.rank;
  d := CASE WHEN cnt > 1 THEN pos::numeric / (cnt - 1) ELSE 0 END;
  pts := 10 - round(8 * d)::int;
  fmt := CASE ((_number - 1) % 3) WHEN 0 THEN 'text' WHEN 1 THEN 'photo_words' ELSE 'image_choice' END;
  q := CASE WHEN fmt = 'text' THEN public._quiz_question(d) || jsonb_build_object('format', 'text') ELSE public._quiz_visual_question(d, fmt) END;
  SELECT label, color INTO lbl, col FROM public.rarities WHERE key = rk;
  UPDATE public.quiz_runs SET cur_answer = q->>'answer', cur_points = pts, cur_rarity = rk WHERE id = _run;
  RETURN (q - 'answer') || jsonb_build_object('number', _number, 'rarity', rk, 'label', coalesce(lbl, rk), 'color', col, 'points', pts);
END $$;
REVOKE ALL ON FUNCTION public._quiz_next(uuid, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_quiz() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid; e timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi pour jouer'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  UPDATE public.quiz_runs SET status = 'done' WHERE user_id = uid AND status = 'live';
  INSERT INTO public.quiz_runs (user_id, ends_at) VALUES (uid, now() + interval '60 seconds') RETURNING id, ends_at INTO rid, e;
  RETURN jsonb_build_object('run_id', rid, 'ends_at', e, 'server_now', now(), 'question', public._quiz_next(rid, 1));
END $$;
REVOKE ALL ON FUNCTION public.start_quiz() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz() TO authenticated;
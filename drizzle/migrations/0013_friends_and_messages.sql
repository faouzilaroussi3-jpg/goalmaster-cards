-- Friends (requests + accepted friendships) and private messages between friends.
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendships_pair_uniq ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id);
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own friendships readable" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX messages_pair_idx ON public.messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);
CREATE INDEX messages_unread_idx ON public.messages (recipient_id) WHERE read_at IS NULL;
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages readable" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Send a request; if the other player already asked me, this accepts it instead.
CREATE OR REPLACE FUNCTION public.send_friend_request(_to uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _f public.friendships;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _to IS NULL OR _to = _me THEN RAISE EXCEPTION 'Tu ne peux pas t''ajouter toi-même'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _to) THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
  SELECT * INTO _f FROM friendships
   WHERE LEAST(requester_id, addressee_id) = LEAST(_me, _to) AND GREATEST(requester_id, addressee_id) = GREATEST(_me, _to)
   FOR UPDATE;
  IF FOUND THEN
    IF _f.status = 'accepted' THEN RAISE EXCEPTION 'Vous êtes déjà amis'; END IF;
    IF _f.requester_id = _me THEN RAISE EXCEPTION 'Demande déjà envoyée'; END IF;
    UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = _f.id;
    RETURN 'accepted';
  END IF;
  IF (SELECT count(*) FROM friendships WHERE requester_id = _me AND status = 'pending') >= 50 THEN
    RAISE EXCEPTION 'Trop de demandes en attente';
  END IF;
  INSERT INTO friendships (requester_id, addressee_id) VALUES (_me, _to);
  RETURN 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_friendship_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _f public.friendships;
BEGIN
  SELECT * INTO _f FROM friendships WHERE id = _friendship_id FOR UPDATE;
  IF NOT FOUND OR _f.addressee_id <> _me OR _f.status <> 'pending' THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF _accept THEN
    UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = _f.id;
  ELSE
    DELETE FROM friendships WHERE id = _f.id;
  END IF;
END $$;

-- Cancel my request, or unfriend someone (messages are kept).
CREATE OR REPLACE FUNCTION public.remove_friend(_friendship_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM friendships WHERE id = _friendship_id AND (requester_id = auth.uid() OR addressee_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Introuvable'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS TABLE (friendship_id uuid, user_id uuid, username text, level integer, status text, incoming boolean,
               unread bigint, last_message text, last_at timestamptz, last_from_me boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, o.id, o.username, o.level, f.status, (f.addressee_id = auth.uid() AND f.status = 'pending'),
    (SELECT count(*) FROM messages m WHERE m.sender_id = o.id AND m.recipient_id = auth.uid() AND m.read_at IS NULL),
    lm.body, lm.created_at, lm.sender_id = auth.uid(), f.created_at
  FROM friendships f
  JOIN profiles o ON o.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at, m.sender_id FROM messages m
    WHERE LEAST(m.sender_id, m.recipient_id) = LEAST(auth.uid(), o.id) AND GREATEST(m.sender_id, m.recipient_id) = GREATEST(auth.uid(), o.id)
    ORDER BY m.created_at DESC LIMIT 1
  ) lm ON f.status = 'accepted'
  WHERE f.requester_id = auth.uid() OR f.addressee_id = auth.uid()
  ORDER BY COALESCE(lm.created_at, f.responded_at, f.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.search_players(_q text)
RETURNS TABLE (user_id uuid, username text, level integer, relation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.level,
    CASE WHEN f.id IS NULL THEN 'none'
         WHEN f.status = 'accepted' THEN 'friends'
         WHEN f.requester_id = auth.uid() THEN 'sent'
         ELSE 'received' END
  FROM profiles p
  LEFT JOIN friendships f ON LEAST(f.requester_id, f.addressee_id) = LEAST(auth.uid(), p.id)
                         AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(auth.uid(), p.id)
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid() AND char_length(trim(_q)) >= 2
    AND p.username ILIKE '%' || replace(replace(replace(trim(_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ORDER BY (lower(p.username) = lower(trim(_q))) DESC, p.username
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.send_message(_to uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _text text := btrim(_body); _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _text IS NULL OR char_length(_text) = 0 THEN RAISE EXCEPTION 'Message vide'; END IF;
  IF char_length(_text) > 500 THEN RAISE EXCEPTION 'Message trop long (500 caractères max)'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM friendships WHERE status = 'accepted'
      AND LEAST(requester_id, addressee_id) = LEAST(_me, _to) AND GREATEST(requester_id, addressee_id) = GREATEST(_me, _to)
  ) THEN RAISE EXCEPTION 'Tu ne peux écrire qu''à tes amis'; END IF;
  IF (SELECT count(*) FROM messages WHERE sender_id = _me AND created_at > now() - interval '10 seconds') >= 8 THEN
    RAISE EXCEPTION 'Doucement ! Attends quelques secondes';
  END IF;
  INSERT INTO messages (sender_id, recipient_id, body) VALUES (_me, _to, _text) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(_from uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE messages SET read_at = now() WHERE recipient_id = auth.uid() AND sender_id = _from AND read_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.get_friends(), public.search_players(text), public.send_message(uuid, text), public.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.get_friends(), public.search_players(text), public.send_message(uuid, text), public.mark_messages_read(uuid) TO authenticated;

ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

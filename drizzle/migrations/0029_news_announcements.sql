-- Nouveautés: written only by triggers on cards / rarities / pack_types; players read them and mark them seen.
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('card', 'rarity', 'pack')),
  ref text,
  title text NOT NULL,
  body text,
  item_count integer NOT NULL DEFAULT 1,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_updated_idx ON public.announcements (updated_at DESC);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players read announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.announcement_reads (
  user_id uuid PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read their own news state" ON public.announcement_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_news_seen()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid := auth.uid(); t timestamptz := now();
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  insert into public.announcement_reads(user_id, seen_at) values (uid, t)
  on conflict (user_id) do update set seen_at = excluded.seen_at;
  return t;
end $$;
REVOKE ALL ON FUNCTION public.mark_news_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_news_seen() TO authenticated;

-- New cards: one announcement per batch; cards added within 30 minutes of the last card news merge into it.
-- Secret Ultimate cards (and rarities playing as it) are never announced, so the tier stays secret.
CREATE OR REPLACE FUNCTION public._announce_new_cards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n integer; picked jsonb; last_id uuid; last_items jsonb;
begin
  select count(*) into n from new_cards c where c.active and public._rarity_fx(c.rarity) <> 'secret_ultimate';
  if n = 0 then return null; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into picked from (
    select jsonb_build_object('id', c.id, 'name', c.name, 'club', c.club, 'nationality', c.nationality, 'pos', c.pos,
      'rating', c.rating, 'rarity', c.rarity, 'image_url', c.image_url, 'alt_image_url', c.alt_image_url) as x
    from new_cards c join public.rarities r on r.key = c.rarity
    where c.active and public._rarity_fx(c.rarity) <> 'secret_ultimate'
    order by r.rank desc, c.rating desc limit 8) s;
  select a.id, a.items into last_id, last_items from public.announcements a
    where a.kind = 'card' and a.updated_at > now() - interval '30 minutes' order by a.updated_at desc limit 1;
  if last_id is not null then
    update public.announcements set
      item_count = item_count + n,
      title = (item_count + n) || ' nouvelle' || case when item_count + n > 1 then 's cartes' else ' carte' end,
      items = (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
        select e from jsonb_array_elements(picked || last_items) e
        order by coalesce((select r.rank from public.rarities r where r.key = e->>'rarity'), 0) desc, (e->>'rating')::int desc limit 8) t),
      updated_at = now()
    where id = last_id;
  else
    insert into public.announcements(kind, title, body, item_count, items)
    values ('card', n || ' nouvelle' || case when n > 1 then 's cartes' else ' carte' end,
      'De nouveaux joueurs sont arrivés dans les packs.', n, picked);
  end if;
  return null;
end $$;
CREATE TRIGGER cards_announce AFTER INSERT ON public.cards
  REFERENCING NEW TABLE AS new_cards FOR EACH STATEMENT EXECUTE FUNCTION public._announce_new_cards();

CREATE OR REPLACE FUNCTION public._announce_new_rarity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not new.active or public._effect_base(new.effect) = 'secret_ultimate' or new.key = 'secret_ultimate' then return new; end if;
  insert into public.announcements(kind, ref, title, body, items)
  values ('rarity', new.key, 'Nouvelle rareté : ' || new.label, 'Une nouvelle rareté vient d''apparaître. Sauras-tu la tirer ?',
    jsonb_build_array(jsonb_build_object('key', new.key, 'label', new.label, 'short', new.short_label, 'color', new.color,
      'effect', new.effect, 'extra_effects', to_jsonb(new.extra_effects), 'shape', new.shape, 'tier', new.tier)));
  return new;
end $$;
CREATE TRIGGER rarities_announce AFTER INSERT ON public.rarities FOR EACH ROW EXECUTE FUNCTION public._announce_new_rarity();

-- Packs are created switched off, so they are announced the first time they become playable.
CREATE OR REPLACE FUNCTION public._announce_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not new.active or new.archived then return new; end if;
  if tg_op = 'UPDATE' and old.active and not old.archived then return new; end if;
  if exists (select 1 from public.announcements a where a.kind = 'pack' and a.ref = new.key) then return new; end if;
  insert into public.announcements(kind, ref, title, body, items)
  values ('pack', new.key, 'Nouveau pack : ' || new.name, coalesce(new.description, 'Un nouveau pack est disponible.'),
    jsonb_build_array(jsonb_build_object('key', new.key, 'name', new.name, 'art', new.art, 'tint', new.tint,
      'effect', new.effect, 'image_url', new.image_url, 'price_coins', new.price_coins)));
  return new;
end $$;
CREATE TRIGGER pack_types_announce AFTER INSERT OR UPDATE OF active, archived ON public.pack_types FOR EACH ROW EXECUTE FUNCTION public._announce_pack();

ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
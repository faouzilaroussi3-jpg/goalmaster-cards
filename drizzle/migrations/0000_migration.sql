create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  coins integer not null default 1000,
  xp integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated, anon;
grant update (username, avatar_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.rarities (
  key text primary key,
  label text not null,
  short_label text not null,
  tier integer not null unique,
  duplicate_coins integer not null default 10
);
grant select on public.rarities to authenticated, anon;
grant insert, update, delete on public.rarities to authenticated;
grant all on public.rarities to service_role;
alter table public.rarities enable row level security;
create policy "rarities readable" on public.rarities for select using (true);
create policy "admin manage rarities" on public.rarities for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.rarities (key,label,short_label,tier,duplicate_coins) values
('common','Commune','C',1,5),
('uncommon','Peu commune','PC',2,10),
('rare','Rare','R',3,25),
('super_rare','Super Rare','SR',4,60),
('legendary','Légendaire','L',5,150),
('secret_legendary','Secrète Légendaire','SL',6,400),
('secret_ultimate','Secrète Ultime','SU',7,1500);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club text not null,
  nationality text not null,
  pos text not null,
  rating integer not null,
  rarity text not null references public.rarities(key),
  image_url text,
  has_alt boolean not null default false,
  has_shiny boolean not null default false,
  revealed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.cards to authenticated, anon;
grant insert, update, delete on public.cards to authenticated;
grant all on public.cards to service_role;
alter table public.cards enable row level security;
create policy "cards visible unless hidden ultimate" on public.cards for select
  using (rarity <> 'secret_ultimate' or revealed or public.has_role(auth.uid(),'admin'));
create policy "admin manage cards" on public.cards for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.pack_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  slot_count integer not null default 5,
  slot_rates jsonb not null,
  bonus_rates jsonb not null,
  regen_minutes integer not null default 0,
  max_stock integer not null default 10,
  initial_stock integer not null default 0,
  price_coins integer not null default 0,
  xp_reward integer not null default 10,
  active boolean not null default true,
  sort_order integer not null default 0
);
grant select on public.pack_types to authenticated, anon;
grant insert, update, delete on public.pack_types to authenticated;
grant all on public.pack_types to service_role;
alter table public.pack_types enable row level security;
create policy "packs readable" on public.pack_types for select using (true);
create policy "admin manage packs" on public.pack_types for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.pack_types (key,name,description,slot_rates,bonus_rates,regen_minutes,max_stock,initial_stock,price_coins,xp_reward,sort_order) values
('classic','Pack Classique','5 cartes + 1 carte bonus. 1 pack toutes les 10 minutes.',
 '{"common":50,"uncommon":25,"rare":15,"super_rare":7,"legendary":2,"secret_legendary":0.8,"secret_ultimate":0.2}',
 '{"normal":80,"alt":15,"shiny":4,"ultimate":1}', 10, 10, 10, 0, 10, 1),
('premium','Pack Premium','5 cartes Super Rare ou mieux + 1 bonus spécial.',
 '{"super_rare":65,"legendary":25,"secret_legendary":8,"secret_ultimate":2}',
 '{"normal":60,"alt":25,"shiny":12,"ultimate":3}', 720, 3, 1, 800, 40, 2);

create table public.pack_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pack_type_id uuid not null references public.pack_types(id) on delete cascade,
  count integer not null default 0,
  last_regen_at timestamptz not null default now(),
  unique (user_id, pack_type_id)
);
grant select on public.pack_stocks to authenticated;
grant all on public.pack_stocks to service_role;
alter table public.pack_stocks enable row level security;
create policy "own stocks" on public.pack_stocks for select to authenticated using (user_id = auth.uid());

create table public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pack_type_id uuid not null references public.pack_types(id),
  results jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index on public.pack_openings(user_id, created_at desc);
grant select on public.pack_openings to authenticated;
grant all on public.pack_openings to service_role;
alter table public.pack_openings enable row level security;
create policy "own openings" on public.pack_openings for select to authenticated using (user_id = auth.uid());

create table public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null references public.cards(id) on delete cascade,
  version text not null default 'normal' check (version in ('normal','alt','shiny')),
  opening_id uuid references public.pack_openings(id) on delete set null,
  obtained_at timestamptz not null default now()
);
create index on public.user_cards(user_id);
create index on public.user_cards(obtained_at desc);
grant select on public.user_cards to authenticated;
grant all on public.user_cards to service_role;
alter table public.user_cards enable row level security;
create policy "own cards" on public.user_cards for select to authenticated using (user_id = auth.uid());

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  pack_key text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.events to authenticated, anon;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events readable" on public.events for select using (true);
create policy "admin manage events" on public.events for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.events (title, description, pack_key, ends_at) values
('Nuit des Légendes', 'Les cartes Légendaires ALT brillent plus fort cette semaine. Ouvrez des packs Premium !', 'premium', now() + interval '7 days'),
('Saison 1 : Coup d''envoi', 'Bienvenue sur Goalmaster ! Chaque pack ouvert rapporte de l''XP.', 'classic', now() + interval '30 days');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1), 'Joueur'));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public._draw_key(_w jsonb)
returns text language plpgsql volatile set search_path = public as $$
declare total numeric; roll numeric; acc numeric := 0; k text; val numeric; last_k text;
begin
  select sum(value::numeric) into total from jsonb_each_text(_w);
  if total is null or total <= 0 then return null; end if;
  roll := random() * total;
  for k, val in select key, value::numeric from jsonb_each_text(_w) loop
    acc := acc + val; last_k := k;
    if roll < acc then return k; end if;
  end loop;
  return last_k;
end $$;

create or replace function public._sync_stock(_uid uuid, _pt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pt public.pack_types%rowtype; st public.pack_stocks%rowtype; n integer;
begin
  select * into pt from public.pack_types where id = _pt;
  insert into public.pack_stocks (user_id, pack_type_id, count, last_regen_at)
    values (_uid, _pt, pt.initial_stock, now()) on conflict (user_id, pack_type_id) do nothing;
  select * into st from public.pack_stocks where user_id = _uid and pack_type_id = _pt for update;
  if pt.regen_minutes <= 0 then return; end if;
  if st.count >= pt.max_stock then
    update public.pack_stocks set last_regen_at = now() where id = st.id;
    return;
  end if;
  n := floor(extract(epoch from (now() - st.last_regen_at)) / (pt.regen_minutes * 60));
  if n > 0 then
    if st.count + n >= pt.max_stock then
      update public.pack_stocks set count = pt.max_stock, last_regen_at = now() where id = st.id;
    else
      update public.pack_stocks set count = count + n,
        last_regen_at = last_regen_at + make_interval(mins => n * pt.regen_minutes) where id = st.id;
    end if;
  end if;
end $$;

create or replace function public.get_my_packs()
returns table (pack_key text, name text, description text, count integer, max_stock integer, regen_minutes integer, next_at timestamptz, price_coins integer)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p record;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  for p in select id from public.pack_types where active order by sort_order loop
    perform public._sync_stock(uid, p.id);
  end loop;
  return query
    select pt.key, pt.name, pt.description, s.count, pt.max_stock, pt.regen_minutes,
      case when pt.regen_minutes > 0 and s.count < pt.max_stock then s.last_regen_at + make_interval(mins => pt.regen_minutes) else null end,
      pt.price_coins
    from public.pack_types pt join public.pack_stocks s on s.pack_type_id = pt.id and s.user_id = uid
    where pt.active order by pt.sort_order;
end $$;

create or replace function public._pick_card(_rarity text)
returns uuid language sql volatile security definer set search_path = public as $$
  select c.id from public.cards c join public.rarities r on r.key = c.rarity
  where c.active and r.tier <= (select tier from public.rarities where key = _rarity)
  order by r.tier desc, random() limit 1
$$;

create or replace function public.open_pack(_pack_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pt public.pack_types%rowtype;
  st public.pack_stocks%rowtype;
  op_id uuid;
  res jsonb := '[]'::jsonb;
  i integer; r text; v text; bk text; cid uuid; is_new boolean; dup integer; coins_gain integer := 0;
  c record;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  select * into pt from public.pack_types where key = _pack_key and active;
  if not found then raise exception 'Pack introuvable'; end if;
  perform public._sync_stock(uid, pt.id);
  select * into st from public.pack_stocks where user_id = uid and pack_type_id = pt.id for update;
  if st.count < 1 then raise exception 'Aucun pack disponible'; end if;
  update public.pack_stocks set count = count - 1,
    last_regen_at = case when st.count >= pt.max_stock then now() else last_regen_at end
    where id = st.id;

  insert into public.pack_openings (user_id, pack_type_id) values (uid, pt.id) returning id into op_id;

  for i in 1 .. pt.slot_count + 1 loop
    v := 'normal'; cid := null;
    if i <= pt.slot_count then
      r := public._draw_key(pt.slot_rates);
      cid := public._pick_card(r);
    else
      bk := public._draw_key(pt.bonus_rates);
      if bk = 'alt' then
        select id into cid from public.cards where active and has_alt order by random() limit 1;
        if cid is not null then v := 'alt'; end if;
      elsif bk = 'shiny' then
        select id into cid from public.cards where active and has_shiny order by random() limit 1;
        if cid is not null then v := 'shiny'; end if;
      elsif bk = 'ultimate' then
        select id into cid from public.cards where active and rarity = 'secret_ultimate' order by random() limit 1;
      end if;
      if cid is null then cid := public._pick_card(public._draw_key(pt.slot_rates)); end if;
    end if;
    if cid is null then continue; end if;

    select ca.id, ca.name, ca.club, ca.nationality, ca.pos, ca.rating, ca.rarity, ca.image_url, ca.revealed,
      ra.label as rarity_label, ra.tier, ra.duplicate_coins into c
      from public.cards ca join public.rarities ra on ra.key = ca.rarity where ca.id = cid;
    is_new := not exists (select 1 from public.user_cards where user_id = uid and card_id = cid and version = v);
    dup := case when is_new then 0 else c.duplicate_coins end;
    coins_gain := coins_gain + dup;
    if c.rarity = 'secret_ultimate' and not c.revealed then
      update public.cards set revealed = true where id = cid;
    end if;
    insert into public.user_cards (user_id, card_id, version, opening_id) values (uid, cid, v, op_id);
    res := res || jsonb_build_array(jsonb_build_object(
      'slot', i, 'is_bonus', i > pt.slot_count, 'card_id', cid, 'name', c.name, 'club', c.club,
      'nationality', c.nationality, 'pos', c.pos, 'rating', c.rating, 'rarity', c.rarity,
      'rarity_label', c.rarity_label, 'tier', c.tier, 'image_url', c.image_url, 'version', v,
      'is_new', is_new, 'duplicate_coins', dup));
  end loop;

  update public.pack_openings set results = res where id = op_id;
  update public.profiles set coins = coins + coins_gain, xp = xp + pt.xp_reward,
    level = ((xp + pt.xp_reward) / 100) + 1 where id = uid;
  return jsonb_build_object('opening_id', op_id, 'cards', res, 'coins_gained', coins_gain, 'xp_gained', pt.xp_reward);
end $$;

create or replace function public.buy_pack(_pack_key text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pt public.pack_types%rowtype; bal integer;
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  select * into pt from public.pack_types where key = _pack_key and active;
  if not found or pt.price_coins <= 0 then raise exception 'Ce pack ne peut pas être acheté'; end if;
  select coins into bal from public.profiles where id = uid for update;
  if bal < pt.price_coins then raise exception 'Pièces insuffisantes'; end if;
  perform public._sync_stock(uid, pt.id);
  update public.profiles set coins = coins - pt.price_coins where id = uid;
  update public.pack_stocks set count = count + 1 where user_id = uid and pack_type_id = pt.id;
end $$;

create or replace function public.get_leaderboard(_sort text default 'total', _limit integer default 50)
returns table (user_id uuid, username text, level integer, total bigint, unique_cards bigint, legendaries bigint, shinies bigint, ultimates bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.level,
    count(uc.id), count(distinct (uc.card_id, uc.version)),
    count(uc.id) filter (where c.rarity in ('legendary','secret_legendary')),
    count(uc.id) filter (where uc.version = 'shiny'),
    count(uc.id) filter (where c.rarity = 'secret_ultimate')
  from public.profiles p
  left join public.user_cards uc on uc.user_id = p.id
  left join public.cards c on c.id = uc.card_id
  group by p.id
  order by case _sort when 'legendaries' then count(uc.id) filter (where c.rarity in ('legendary','secret_legendary'))
    when 'shinies' then count(uc.id) filter (where uc.version = 'shiny')
    when 'ultimates' then count(uc.id) filter (where c.rarity = 'secret_ultimate')
    else count(uc.id) end desc, p.level desc
  limit least(_limit, 100)
$$;

create or replace function public.get_recent_drops(_limit integer default 12)
returns table (username text, name text, club text, rarity text, rating integer, pos text, nationality text, image_url text, version text, obtained_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.username, c.name, c.club, c.rarity, c.rating, c.pos, c.nationality, c.image_url, uc.version, uc.obtained_at
  from public.user_cards uc join public.cards c on c.id = uc.card_id
  join public.rarities r on r.key = c.rarity
  join public.profiles p on p.id = uc.user_id
  where r.tier >= 3
  order by uc.obtained_at desc limit least(_limit, 50)
$$;

revoke execute on function public._draw_key(jsonb) from public, anon, authenticated;
revoke execute on function public._sync_stock(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._pick_card(text) from public, anon, authenticated;
revoke execute on function public.open_pack(text) from public, anon;
revoke execute on function public.buy_pack(text) from public, anon;
revoke execute on function public.get_my_packs() from public, anon;
grant execute on function public.open_pack(text) to authenticated;
grant execute on function public.buy_pack(text) to authenticated;
grant execute on function public.get_my_packs() to authenticated;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
grant execute on function public.get_recent_drops(integer) to anon, authenticated;

insert into public.cards (name, club, nationality, pos, rating, rarity, has_alt, has_shiny) values
('Lucas Mendy','FC Nantes','France','DC',68,'common',false,false),
('Tom Berger','RC Lens','France','MC',67,'common',false,false),
('Iker Sola','Real Betis','Espagne','AG',69,'common',false,false),
('Marco Ricci','Torino','Italie','DD',66,'common',false,false),
('Jonas Weber','Mainz 05','Allemagne','G',68,'common',false,false),
('Liam Carter','Brentford','Angleterre','BU',70,'common',false,false),
('Rui Costa Neto','Braga','Portugal','MDC',67,'common',false,false),
('Ayoub Sami','Toulouse FC','Maroc','AD',69,'common',false,false),
('Pieter Jansen','AZ Alkmaar','Pays-Bas','DG',66,'common',false,false),
('Diego Ramos','Getafe','Espagne','DC',68,'common',false,false),
('Noah Keller','Freiburg','Suisse','MOC',70,'common',false,false),
('Karim Ouali','Stade Brestois','Algérie','MC',69,'common',false,false),
('Hugo Laurent','OGC Nice','France','MOC',74,'uncommon',false,false),
('Mateo Ferraz','Benfica','Portugal','AG',75,'uncommon',false,false),
('Erik Holm','Copenhague','Danemark','DC',73,'uncommon',false,false),
('Samuel Okoye','Porto','Nigeria','BU',75,'uncommon',false,false),
('Luca Bianchi','Atalanta','Italie','MC',74,'uncommon',false,false),
('Felix Braun','Leverkusen','Allemagne','DD',73,'uncommon',false,false),
('Youssef Amrani','Olympique Lyonnais','Maroc','MDC',74,'uncommon',false,false),
('Oliver Grant','Aston Villa','Angleterre','G',75,'uncommon',false,false),
('Thiago Alves','Atlético Madrid','Brésil','MOC',80,'rare',false,false),
('Kylian Dubois','Paris SG','France','AG',81,'rare',false,false),
('Jude Ashford','Arsenal','Angleterre','MC',80,'rare',false,false),
('Sven Lindqvist','Dortmund','Suède','BU',79,'rare',false,false),
('Rafael Silva','Inter Milan','Brésil','DC',80,'rare',false,false),
('Moussa Diallo','Olympique de Marseille','Sénégal','MDC',79,'rare',false,false),
('Pablo Navarro','Séville FC','Espagne','DG',78,'rare',false,false),
('Andrés Vega','FC Barcelone','Espagne','MOC',85,'super_rare',false,false),
('Marcus Hale','Manchester City','Angleterre','AD',86,'super_rare',false,false),
('Leon Fischer','Bayern Munich','Allemagne','G',85,'super_rare',false,false),
('Victor Osei','Naples','Ghana','BU',86,'super_rare',false,false),
('Enzo Moreau','Real Madrid','France','MC',87,'super_rare',false,false),
('Gabriel Santos','Liverpool','Brésil','AG',90,'legendary',true,false),
('Alessandro Conti','Juventus','Italie','DC',89,'legendary',true,false),
('Malik Traoré','Paris SG','Côte d''Ivoire','BU',91,'legendary',true,false),
('Hendrik Vos','Ajax','Pays-Bas','MOC',90,'legendary',true,false),
('El Maestro','Légendes FC','Argentine','MOC',94,'secret_legendary',false,true),
('Le Fantôme','Légendes FC','Brésil','BU',95,'secret_legendary',false,true),
('Le Mur','Légendes FC','Italie','DC',93,'secret_legendary',false,true),
('L''Immortel','Panthéon','Monde','AT',99,'secret_ultimate',false,false);
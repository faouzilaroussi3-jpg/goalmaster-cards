CREATE OR REPLACE FUNCTION public.admin_card_stats()
RETURNS TABLE(card_id uuid, owners bigint, copies bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  return query select uc.card_id, count(distinct uc.user_id), count(*) from public.user_cards uc group by uc.card_id;
end $$;

-- Moves every copy of one card into another card (keeping ALT/Shiny only when the target has that version), then deletes the old card.
CREATE OR REPLACE FUNCTION public.admin_replace_card(_from uuid, _to uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare moved integer; t public.cards%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Réservé aux administrateurs'; end if;
  if _from = _to then raise exception 'Choisis une autre carte'; end if;
  select * into t from public.cards where id = _to;
  if not found then raise exception 'Carte de remplacement introuvable'; end if;
  if not exists (select 1 from public.cards where id = _from) then raise exception 'Carte introuvable'; end if;
  update public.user_cards set card_id = _to,
    version = case when version = 'alt' and not t.has_alt then 'normal'
                   when version = 'shiny' and not t.has_shiny then 'normal'
                   else version end
    where card_id = _from;
  get diagnostics moved = row_count;
  if t.rarity = 'secret_ultimate' and moved > 0 then update public.cards set revealed = true where id = _to; end if;
  delete from public.cards where id = _from;
  return moved;
end $$;

REVOKE ALL ON FUNCTION public.admin_card_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_replace_card(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_card_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_card(uuid, uuid) TO authenticated;
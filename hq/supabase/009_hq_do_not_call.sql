-- Dead means gone, but never forgotten: the number and the Google place id go on a block list
-- the Prospector checks before inserting (rx_is_blocked), so the same shop never comes back.
-- Run after 008_hq_post_results.sql. Idempotent.
create table if not exists public.rx_do_not_call (
  id uuid primary key default gen_random_uuid(),
  phone text, google_place_id text, name text, reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists rx_dnc_phone on public.rx_do_not_call(phone) where phone is not null;
create unique index if not exists rx_dnc_place on public.rx_do_not_call(google_place_id) where google_place_id is not null;
alter table public.rx_do_not_call enable row level security;
create or replace function public.rx_prospect_dead_trigger() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'dead' and (old.status is distinct from 'dead') then
    insert into rx_do_not_call (phone, google_place_id, name, reason) values (new.phone, new.google_place_id, new.name, 'marked dead in HQ') on conflict do nothing;
  end if;
  return new;
end $$;
create or replace trigger rx_prospect_dead after update of status on public.rx_prospects for each row execute function public.rx_prospect_dead_trigger();
insert into rx_do_not_call (phone, google_place_id, name, reason) select phone, google_place_id, name, 'marked dead in HQ' from rx_prospects where status='dead' on conflict do nothing;
create or replace function public.rx_is_blocked(p_phone text, p_place text) returns boolean language sql stable as $$
  select exists (select 1 from rx_do_not_call d where (p_phone is not null and regexp_replace(d.phone,'\D','','g') = regexp_replace(p_phone,'\D','','g')) or (p_place is not null and d.google_place_id = p_place))
$$;
create or replace function public.hq_dnc_count() returns int language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (select count(*)::int from rx_do_not_call) else 0 end
$$;
grant execute on function public.hq_dnc_count() to authenticated;

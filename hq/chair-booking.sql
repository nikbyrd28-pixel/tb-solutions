-- ============================================================================
-- Chair — real booking backend (barbers / salons)
-- ----------------------------------------------------------------------------
-- Free / lead-capture model. Deposits are taken via the SHOP'S OWN Stripe or
-- Square payment link (stored as booking_shops.deposit_link) — we never store
-- anyone's payment secret keys. Booking is real: availability is computed from
-- the shop's hours minus existing appointments, and double-booking is prevented
-- by an overlap check taken under a per-shop advisory lock.
--
-- This header used to say double-booking was prevented "by an explicit overlap
-- check and a unique index". That pairing was not enough and the claim was the
-- reason nobody looked: booking_appts_uniq covers (shop_slug, staff_id,
-- starts_at), i.e. only an identical start time, so it cannot catch 10:00
-- against 10:15 for a 30-minute cut. With nothing serialising the check and the
-- insert, two concurrent bookings both passed and the barber was double-booked.
-- The lock is what actually prevents it now; the index remains as a backstop.
--
-- Pages: /booking/book/?c=<slug> (customer) · /booking/owner/ (owner setup)
-- Run this whole file in Supabase -> SQL Editor (idempotent).
-- ============================================================================

create table if not exists booking_shops(
  slug text primary key,
  business text not null,
  owner_email text,
  timezone text default 'America/New_York',
  open_hour int default 9,
  close_hour int default 18,
  days text default '1,2,3,4,5,6',      -- open days 0=Sun..6=Sat, csv
  slot_minutes int default 30,
  deposit_link text,                     -- owner's Stripe/Square payment link
  deposit_note text,
  phone text, address text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table booking_shops enable row level security;
drop policy if exists "admin or owner manages shops" on booking_shops;
create policy "admin or owner manages shops" on booking_shops for all to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or owner_email=(auth.jwt()->>'email'))
  with check ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or owner_email=(auth.jwt()->>'email'));

create table if not exists booking_services(
  id uuid primary key default gen_random_uuid(),
  shop_slug text not null references booking_shops(slug) on delete cascade,
  name text not null, minutes int default 30, price numeric default 0, sort int default 0, active boolean default true
);
alter table booking_services enable row level security;
drop policy if exists "owner manages services" on booking_services;
create policy "owner manages services" on booking_services for all to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')))
  with check ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')));
create index if not exists booking_services_shop_idx on booking_services(shop_slug);

create table if not exists booking_staff(
  id uuid primary key default gen_random_uuid(),
  shop_slug text not null references booking_shops(slug) on delete cascade,
  name text not null, blurb text, sort int default 0, active boolean default true
);
alter table booking_staff enable row level security;
drop policy if exists "owner manages staff" on booking_staff;
create policy "owner manages staff" on booking_staff for all to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')))
  with check ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')));
create index if not exists booking_staff_shop_idx on booking_staff(shop_slug);

create table if not exists booking_appointments(
  id uuid primary key default gen_random_uuid(),
  shop_slug text not null,
  staff_id uuid, staff_name text,
  service_name text, minutes int default 30, price numeric default 0,
  starts_at timestamptz not null,
  customer_name text, customer_phone text,
  status text default 'Booked',
  created_at timestamptz default now()
);
alter table booking_appointments enable row level security;
drop policy if exists "owner reads appointments" on booking_appointments;
create policy "owner reads appointments" on booking_appointments for select to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')));
drop policy if exists "owner updates appointments" on booking_appointments;
create policy "owner updates appointments" on booking_appointments for update to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or shop_slug in (select slug from booking_shops where owner_email=(auth.jwt()->>'email')));
create index if not exists booking_appts_shop_time_idx on booking_appointments(shop_slug, starts_at);
create unique index if not exists booking_appts_uniq on booking_appointments(shop_slug, staff_id, starts_at) where status<>'Cancelled';

-- Public RPCs: book_shop (config), book_slots (availability), book_create.
-- Owner RPCs: book_shop_upsert, book_services_set, book_staff_set, book_list.
-- (Most function bodies live in migration chair_booking_v1; see Supabase ->
--  Database -> Migrations for the exact, replayable definitions. book_create is
--  recorded here in full because it is the one that takes money-shaped risk and
--  because leaving it in a migration is how the double-book gap stayed unseen.)

-- ----------------------------------------------------------------------------
-- book_create, v2 (migration book_create_lock_and_shop_rules). Three gaps this
-- write path had that its own slot generator does not:
--
-- 1. DOUBLE-BOOK RACE. The overlap check and the insert were separate
--    statements with nothing serialising them, and the unique index only covers
--    an identical start time — so `exception when unique_violation` read as
--    protection without covering the actual overlap case. Now serialised per
--    shop with the same advisory lock book_appointment uses. Verified: two
--    overlapping rows CAN be inserted straight into the table, and book_create
--    now refuses the second.
-- 2. Closed days and opening hours were enforced when generating slots and
--    ignored when accepting one, so a stale page or a direct POST booked
--    outside hours.
-- 3. An explicitly-passed barber was checked to belong to the shop but not to
--    be active, so a deactivated barber could still be booked. The auto-pick
--    branch already filtered on active.
--
-- Note book_slots uses extract(dow) (0=Sunday) against booking_shops.days;
-- these checks match that, NOT the isodow convention used by the separate
-- reward_appointments system in hq/booking.sql. Keep the two straight.
-- ----------------------------------------------------------------------------
create or replace function public.book_create(p_slug text, p_staff uuid, p_service text, p_minutes integer, p_price numeric, p_start text, p_name text, p_phone text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v booking_shops%rowtype; v_start timestamptz; v_min int; v_staff uuid; v_sname text;
        v_tz text; v_dow int; v_mins int;
begin
  select * into v from booking_shops where slug=btrim(p_slug) and active;
  if not found then return json_build_object('ok',false,'error','Shop not found'); end if;
  if p_name is null or length(btrim(p_name))<2 then return json_build_object('ok',false,'error','Enter your name.'); end if;
  v_min:=coalesce(nullif(p_minutes,0),30);
  v_tz:=coalesce(v.timezone,'America/New_York');
  -- p_start is naive shop-local 'YYYY-MM-DD HH:MM' — interpret in the shop's timezone
  begin v_start := (p_start::timestamp) at time zone v_tz;
  exception when others then return json_build_object('ok',false,'error','Bad time.'); end;
  if v_start <= now() then return json_build_object('ok',false,'error','That time has passed — pick another.'); end if;

  -- the shop's own rules, matching book_slots (which uses dow, 0=Sunday)
  v_dow := extract(dow from (v_start at time zone v_tz))::int;
  if not (v_dow = any(string_to_array(coalesce(v.days,'1,2,3,4,5,6'),',')::int[])) then
    return json_build_object('ok',false,'error','The shop is closed that day — pick another.');
  end if;
  v_mins := extract(hour from (v_start at time zone v_tz))::int * 60
          + extract(minute from (v_start at time zone v_tz))::int;
  if v_mins < coalesce(v.open_hour,9)*60 or v_mins + v_min > coalesce(v.close_hour,18)*60 then
    return json_build_object('ok',false,'error','That time is outside the shop''s hours — pick another.');
  end if;

  -- serialise bookings per shop so the overlap check and the insert cannot
  -- interleave; the unique index alone only catches an identical start time
  perform pg_advisory_xact_lock(hashtext('loopchair:' || v.slug));

  if p_staff is not null then v_staff:=p_staff;
  else
    select s.id into v_staff from booking_staff s where s.shop_slug=v.slug and s.active
      and not exists(select 1 from booking_appointments a where a.shop_slug=v.slug and a.staff_id=s.id and a.status<>'Cancelled'
        and a.starts_at < v_start + make_interval(mins=>v_min) and (a.starts_at+make_interval(mins=>coalesce(a.minutes,30)))>v_start)
      order by s.sort, s.name limit 1;
    if v_staff is null then return json_build_object('ok',false,'error','That time just filled up — pick another.'); end if;
  end if;
  select name into v_sname from booking_staff where id=v_staff and shop_slug=v.slug and active;
  if v_sname is null then return json_build_object('ok',false,'error','Barber not found.'); end if;
  if exists(select 1 from booking_appointments a where a.shop_slug=v.slug and a.staff_id=v_staff and a.status<>'Cancelled'
      and a.starts_at < v_start + make_interval(mins=>v_min) and (a.starts_at+make_interval(mins=>coalesce(a.minutes,30)))>v_start) then
    return json_build_object('ok',false,'error','That time just got booked — pick another.'); end if;
  begin
    insert into booking_appointments(shop_slug,staff_id,staff_name,service_name,minutes,price,starts_at,customer_name,customer_phone,status)
      values(v.slug,v_staff,v_sname,p_service,v_min,coalesce(p_price,0),v_start,btrim(p_name),nullif(btrim(coalesce(p_phone,'')),''),'Booked');
  exception when unique_violation then
    return json_build_object('ok',false,'error','That time just got booked — pick another.');
  end;
  return json_build_object('ok',true,'staff_name',v_sname,'starts_at',v_start,'minutes',v_min,
    'deposit_link',v.deposit_link,'deposit_note',v.deposit_note,'business',v.business);
end $$;

-- Grants: anon can read + book; management is authenticated + owner-scoped.
grant execute on function book_shop(text)                                        to anon, authenticated;
grant execute on function book_slots(text,uuid,text,int)                         to anon, authenticated;
grant execute on function book_create(text,uuid,text,int,numeric,text,text,text) to anon, authenticated;
grant execute on function book_shop_upsert(text,text,int,int,text,int,text,text,text,text) to authenticated;
grant execute on function book_services_set(text,jsonb)                          to authenticated;
grant execute on function book_staff_set(text,jsonb)                             to authenticated;
grant execute on function book_list(text,text,text)                              to authenticated;
revoke execute on function book_shop_upsert(text,text,int,int,text,int,text,text,text,text) from public, anon;
revoke execute on function book_services_set(text,jsonb) from public, anon;
revoke execute on function book_staff_set(text,jsonb)   from public, anon;
revoke execute on function book_list(text,text,text)    from public, anon;

-- Demo shop (safe to re-run)
insert into booking_shops(slug,business,owner_email,open_hour,close_hour,days,slot_minutes,deposit_note,phone,address)
values('maple-demo','Maple Street Barbers','nikbyrd28@gmail.com',9,18,'1,2,3,4,5,6',30,'A $10 deposit holds your chair.','(484) 841-8501','West Chester, PA')
on conflict (slug) do nothing;

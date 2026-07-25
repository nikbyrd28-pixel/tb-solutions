-- ============================================================================
-- Chair — real booking backend (barbers / salons)
-- ----------------------------------------------------------------------------
-- Free / lead-capture model. Deposits are taken via the SHOP'S OWN Stripe or
-- Square payment link (stored as booking_shops.deposit_link) — we never store
-- anyone's payment secret keys. Booking is real: availability is computed from
-- the shop's hours minus existing appointments, and double-booking is
-- prevented both by an explicit overlap check and a unique index.
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
-- (Full function bodies live in migration chair_booking_v1; see Supabase ->
--  Database -> Migrations for the exact, replayable definitions.)

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

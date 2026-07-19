-- ============================================================
-- TB Command — Portal, Analytics & Social (v3 add-on)
-- Run once AFTER supabase-schema.sql:
--   Supabase → SQL Editor → New query → paste ALL → Run
-- ============================================================

-- ---------- WEBSITE ANALYTICS: every page visit ----------
create table if not exists public.pageviews (
  id bigint generated always as identity primary key,
  path text, ref text, ua text, w int,
  ts timestamptz not null default now()
);
create index if not exists pageviews_ts_idx on public.pageviews(ts);
alter table public.pageviews enable row level security;
drop policy if exists "anyone can record a view" on public.pageviews;
drop policy if exists "admin reads views" on public.pageviews;
create policy "anyone can record a view" on public.pageviews
  for insert to anon, authenticated with check (true);
create policy "admin reads views" on public.pageviews
  for select to authenticated using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ---------- SOCIAL PLANNER: your post pipeline ----------
create table if not exists public.posts (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text, platform text, status text default 'Idea', post_date date,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "own posts" on public.posts;
create policy "own posts" on public.posts
  for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ---------- CLIENT PROJECT UPDATES (you post, client sees) ----------
create table if not exists public.updates (
  id bigint generated always as identity primary key,
  client_email text not null,
  title text, body text,
  created_at timestamptz not null default now()
);
alter table public.updates enable row level security;
drop policy if exists "admin writes updates" on public.updates;
drop policy if exists "read own updates" on public.updates;
create policy "admin writes updates" on public.updates
  for all to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');
create policy "read own updates" on public.updates
  for select to authenticated using (client_email = (auth.jwt()->>'email'));

-- ---------- PORTAL ACCESS: clients see their own record ----------
drop policy if exists "client sees own record" on public.clients;
create policy "client sees own record" on public.clients
  for select to authenticated using (email = (auth.jwt()->>'email'));

-- ---------- TICKETS & INTAKES now save straight to the database ----------
drop policy if exists "own tickets" on public.tickets;
drop policy if exists "public can file tickets" on public.tickets;
drop policy if exists "read tickets" on public.tickets;
create policy "public can file tickets" on public.tickets
  for insert to anon, authenticated with check (true);
create policy "read tickets" on public.tickets
  for select to authenticated
  using (email = (auth.jwt()->>'email') or (auth.jwt()->>'email') = 'nikbyrd28@gmail.com');
drop policy if exists "admin manages tickets" on public.tickets;
create policy "admin manages tickets" on public.tickets
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

drop policy if exists "own intakes" on public.intakes;
drop policy if exists "public can submit intake" on public.intakes;
drop policy if exists "admin reads intakes" on public.intakes;
create policy "public can submit intake" on public.intakes
  for insert to anon, authenticated with check (true);
create policy "admin reads intakes" on public.intakes
  for select to authenticated using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

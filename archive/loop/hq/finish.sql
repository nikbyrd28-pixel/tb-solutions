-- ============================================================
-- TB Command — ONE-SHOT FINISH SETUP (safe to run more than once)
-- Supabase → SQL Editor → paste ALL of this → Run
-- ============================================================

-- ============================================================
-- TB Command — File uploads (storage bucket)
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- ============================================================

-- Public bucket for client-uploaded screenshots & files.
insert into storage.buckets (id, name, public)
values ('uploads','uploads', true)
on conflict (id) do nothing;

-- Anyone can upload into it (10MB limit is enforced by the pages).
drop policy if exists "anyone can upload to uploads" on storage.objects;
create policy "anyone can upload to uploads" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'uploads');

-- Anyone with the link can view a file (needed so you can open them).
drop policy if exists "public read uploads" on storage.objects;
create policy "public read uploads" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'uploads');

-- No one can overwrite or delete via the public key (immutable uploads).

-- ---------- also: let the admin update intakes (convert / mark done) ----------
drop policy if exists "admin manages intakes" on public.intakes;
create policy "admin manages intakes" on public.intakes
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ============================================================
-- PROSPECTS — every new client-portal signup lands here so the
-- admin sees who created an account (a "prospect" before they're a
-- full client). Public/authenticated INSERT + admin read/manage.
-- ============================================================
create table if not exists public.prospects (
  id         bigint generated always as identity primary key,
  email      text,
  name       text,
  source     text default 'portal signup',
  status     text default 'New',
  created_at timestamptz not null default now()
);
alter table public.prospects enable row level security;

drop policy if exists "anyone can create a prospect" on public.prospects;
create policy "anyone can create a prospect" on public.prospects
  for insert to anon, authenticated with check (true);

drop policy if exists "admin reads prospects" on public.prospects;
create policy "admin reads prospects" on public.prospects
  for select to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

drop policy if exists "admin manages prospects" on public.prospects;
create policy "admin manages prospects" on public.prospects
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ============================================================
-- TB Command — n8n automation unlock
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- Lets the n8n "CRM Autopilot" workflow write website leads into
-- the leads table, and lets the admin see/manage those rows.
-- ============================================================

-- n8n inserts (via service key) have no logged-in user, so allow null owner.
alter table public.leads alter column user_id drop not null;

-- Admin sees and manages every lead, including automation-created ones.
drop policy if exists "admin full access leads" on public.leads;
create policy "admin full access leads" on public.leads
  for all to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ============================================================
-- TB Command — CLIENT LEADS (per-client CRM)
-- Every lead that hits a client's capture page (rides, B2B
-- inquiries) is stored here so you can track/work them in
-- TB Command per client. Public insert + admin read/manage.
-- ============================================================
create table if not exists public.client_leads (
  id         bigint generated always as identity primary key,
  client     text not null,                -- e.g. 'voomlux'
  kind       text default 'lead',          -- ride | b2b | lead
  name       text, phone text, email text,
  company    text,
  service    text, pickup text, dropoff text,
  ride_date  text, passengers text,
  message    text,
  status     text default 'New',           -- New | Contacted | Booked | Won | Lost
  created_at timestamptz not null default now()
);
create index if not exists client_leads_idx on public.client_leads(client, status, created_at);
alter table public.client_leads enable row level security;

drop policy if exists "public can add client leads" on public.client_leads;
create policy "public can add client leads" on public.client_leads
  for insert to anon, authenticated with check (true);

drop policy if exists "admin reads client leads" on public.client_leads;
create policy "admin reads client leads" on public.client_leads
  for select to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

drop policy if exists "admin manages client leads" on public.client_leads;
create policy "admin manages client leads" on public.client_leads
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

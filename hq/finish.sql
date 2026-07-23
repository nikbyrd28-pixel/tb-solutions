-- ============================================================
-- TB Command — COMPLETE ONE-SHOT SETUP
-- Paste ALL of this into Supabase → SQL Editor → Run.
-- Safe to run more than once (won't duplicate or break anything).
-- This single file sets up EVERYTHING: your CRM tables, the client
-- portal (with per-client privacy), file uploads, prospects,
-- per-client leads, website analytics, and the n8n lead automation.
-- ============================================================


-- ############################################################
-- PART 1 of 5 — CORE TABLES (leads, clients, tasks, tickets, intakes)
-- ############################################################

-- ============================================================
-- TB Command Center — organized database schema (v2)
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- Safe to re-run. Supersedes the old single "kv" table (kept for
-- migration — the app auto-copies old data into these tables).
-- ============================================================

-- ---------- LEADS: your outreach pipeline ----------
create table if not exists public.leads (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text,
  business   text,
  phone      text,
  email      text,
  stage      text not null default 'New',
  source     text,
  followup   date,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CLIENTS: people who hired you ----------
create table if not exists public.clients (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business   text,
  name       text,
  phone      text,
  email      text,
  project    text,
  status     text not null default 'Onboarding',
  value      text,
  paylink    text,
  dep        text default 'unpaid',
  bal        text default 'unpaid',
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- TASKS: to-dos & follow-ups ----------
create table if not exists public.tasks (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  due        date,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- TICKETS: support requests from /support ----------
create table if not exists public.tickets (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  name       text, business text, email text, website text,
  ticket_type text, priority text default 'Normal', status text default 'New',
  details    text, attachment text,
  created_at timestamptz not null default now()
);

-- ---------- INTAKES: new-client forms from /start ----------
create table if not exists public.intakes (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  business   text, name text, email text, phone text, website text,
  about      text, goal text, interest text, budget text, timeline text,
  style      text, notes text, status text default 'New',
  created_at timestamptz not null default now()
);

-- ---------- indexes for speed ----------
create index if not exists leads_user_idx    on public.leads(user_id, stage);
create index if not exists leads_follow_idx  on public.leads(user_id, followup);
create index if not exists clients_user_idx  on public.clients(user_id, status);
create index if not exists tasks_user_idx    on public.tasks(user_id, done, due);
create index if not exists tickets_user_idx  on public.tickets(user_id, status);
create index if not exists intakes_user_idx  on public.intakes(user_id, status);

-- ---------- keep updated_at fresh automatically ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists leads_touch   on public.leads;
drop trigger if exists clients_touch on public.clients;
drop trigger if exists tasks_touch   on public.tasks;
create trigger leads_touch   before update on public.leads   for each row execute function public.touch_updated_at();
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger tasks_touch   before update on public.tasks   for each row execute function public.touch_updated_at();

-- ---------- security: each user only sees their own rows ----------
alter table public.leads   enable row level security;
alter table public.clients enable row level security;
alter table public.tasks   enable row level security;
alter table public.tickets enable row level security;
alter table public.intakes enable row level security;

drop policy if exists "own leads"   on public.leads;
drop policy if exists "own clients" on public.clients;
drop policy if exists "own tasks"   on public.tasks;
drop policy if exists "own tickets" on public.tickets;
drop policy if exists "own intakes" on public.intakes;

create policy "own leads"   on public.leads   for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own clients" on public.clients for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own tasks"   on public.tasks   for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own tickets" on public.tickets for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own intakes" on public.intakes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ---------- kv table (v1) kept so the app can migrate old data ----------
create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.kv enable row level security;
drop policy if exists "own rows" on public.kv;
create policy "own rows" on public.kv for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ============================================================
-- n8n (optional, later): to have n8n write tickets/intakes here,
-- give n8n the SERVICE ROLE key (in n8n credentials ONLY — never in
-- a website) and set user_id explicitly to your admin user id.
-- ============================================================


-- ############################################################
-- PART 2 of 5 — PORTAL PRIVACY, ANALYTICS, SOCIAL, UPDATES
-- ############################################################

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


-- ############################################################
-- PART 3 of 5 — UPLOADS, PROSPECTS, CLIENT LEADS, AUTOMATION
-- ############################################################

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


-- ############################################################
-- PART 4 of 5 — CLIENT LOGINS (each client sees only THEIR leads)
-- Lets a client (e.g. VoomLux) log into their own dashboard at
-- tbsol.net/clients/crm and see/work only their own leads.
-- To give a client access: (1) create their login in
-- Supabase → Authentication → Users → Add user, then (2) map that
-- email to their client slug with ONE insert, e.g.:
--   insert into public.client_users(email,client)
--   values ('owner@voomlux.com','voomlux')
--   on conflict (email) do update set client = excluded.client;
-- ############################################################

-- Maps a login email → the client slug they're allowed to see.
create table if not exists public.client_users (
  email      text primary key,
  client     text not null,          -- must match client_leads.client (e.g. 'voomlux')
  created_at timestamptz not null default now()
);
alter table public.client_users enable row level security;

-- Only you (admin) can create/change these mappings.
drop policy if exists "admin manages client_users" on public.client_users;
create policy "admin manages client_users" on public.client_users
  for all to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- A logged-in client can read their own mapping row (to know who they are).
drop policy if exists "user reads own mapping" on public.client_users;
create policy "user reads own mapping" on public.client_users
  for select to authenticated
  using (email = (auth.jwt()->>'email'));

-- A logged-in client can READ the leads for their mapped client slug only.
drop policy if exists "client user reads their leads" on public.client_leads;
create policy "client user reads their leads" on public.client_leads
  for select to authenticated
  using (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')));

-- ...and UPDATE (status changes) on those same leads only — the check
-- keeps them from moving a lead to a client that isn't theirs.
drop policy if exists "client user updates their leads" on public.client_leads;
create policy "client user updates their leads" on public.client_leads
  for update to authenticated
  using (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')))
  with check (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')));


-- ############################################################
-- PART 5 of 5 — REVIEW GETTER (ask happy customers for Google reviews)
-- Logs every review request you send and tracks whether it converted.
-- Works for you AND for clients (sold as a product) via client slug.
-- ############################################################
create table if not exists public.review_requests (
  id          bigint generated always as identity primary key,
  client      text not null default 'tb-solutions',  -- who's asking (slug)
  name        text,
  email       text,
  phone       text,
  review_link text,                                   -- the Google review URL
  status      text not null default 'Sent',           -- Sent | Reviewed | Declined
  created_at  timestamptz not null default now()
);
create index if not exists review_requests_idx on public.review_requests(client, status, created_at);
alter table public.review_requests enable row level security;

-- You (admin) can do everything.
drop policy if exists "admin manages reviews" on public.review_requests;
create policy "admin manages reviews" on public.review_requests
  for all to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- A logged-in client can read/add/update review requests for THEIR slug only.
drop policy if exists "client reads their reviews" on public.review_requests;
create policy "client reads their reviews" on public.review_requests
  for select to authenticated
  using (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')));

drop policy if exists "client adds their reviews" on public.review_requests;
create policy "client adds their reviews" on public.review_requests
  for insert to authenticated
  with check (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')));

drop policy if exists "client updates their reviews" on public.review_requests;
create policy "client updates their reviews" on public.review_requests
  for update to authenticated
  using (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')))
  with check (client in (select cu.client from public.client_users cu
                    where cu.email = (auth.jwt()->>'email')));

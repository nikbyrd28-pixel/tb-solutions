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

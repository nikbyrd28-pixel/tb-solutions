-- D N E Contracting — complete Supabase schema. Run once in SQL Editor.
create extension if not exists pgcrypto;

create table if not exists plumbing_leads (
  id uuid primary key default gen_random_uuid(),
  kind text default 'lead',
  name text not null, phone text not null, email text not null, town text,
  type text, timeline text, budget text, notes text, contact_pref text,
  score int default 0, score_tier text,
  status text default 'new',  -- new, contacted, booked, consulted, quoted, signed, active, complete, cold, lost
  source text, utm_source text, utm_medium text, utm_campaign text, gclid text, fbclid text,
  email_opened_at timestamptz, last_touch_at timestamptz, booked_at timestamptz, consult_date date,
  created_at timestamptz default now()
);
create index if not exists leads_status_idx on plumbing_leads(status, created_at desc);

create table if not exists contact_notes (
  id uuid primary key default gen_random_uuid(), name text, phone text, email text, message text, created_at timestamptz default now());

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_name text, referrer_phone text, friend_name text, friend_contact text, note text,
  status text default 'new', -- new, contacted, booked, project, paid_100, paid_250
  created_at timestamptz default now());

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(), lead_id uuid references plumbing_leads(id),
  quote_number text, scope text, total numeric, deposit numeric, timeline_weeks int,
  status text default 'sent', -- sent, viewed, accepted, declined, expired
  sent_at timestamptz default now(), expires_at timestamptz default now() + interval '14 days', accepted_at timestamptz);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(), lead_id uuid references plumbing_leads(id),
  customer_email text not null, customer_name text, title text,
  current_stage text, percent_complete int default 0, next_step text,
  start_date date, estimated_completion text, total_cost numeric, amount_paid numeric default 0,
  next_payment_amount numeric, next_payment_due text,
  timeline jsonb default '[]', photos jsonb default '[]', invoices jsonb default '[]',
  docs jsonb default '[]', messages jsonb default '[]',
  status text default 'active', completed_at date, created_at timestamptz default now());
create index if not exists projects_email_idx on projects(customer_email);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(), project_id uuid references projects(id),
  invoice_number text, milestone text, amount numeric, due_date date,
  status text default 'sent', stripe_payment_link text, stripe_payment_id text, paid_at timestamptz,
  created_at timestamptz default now());

create table if not exists message_log (
  id uuid primary key default gen_random_uuid(), lead_id uuid, project_id uuid,
  channel text, template text, sent_at timestamptz default now(), opened_at timestamptz);

-- Row level security: portal clients only see their own project
alter table projects enable row level security;
create policy "client reads own project" on projects for select using (auth.jwt()->>'email' = customer_email);
alter table plumbing_leads enable row level security;   -- no public policy: only service role (n8n) reads
alter table invoices enable row level security;
create policy "client reads own invoices" on invoices for select
  using (project_id in (select id from projects where customer_email = auth.jwt()->>'email'));

-- Views mom can open in the Supabase table editor
create or replace view leads_today as select name, phone, type, timeline, budget, score_tier, contact_pref, town, notes, created_at
  from plumbing_leads where created_at > now() - interval '1 day' order by score desc;
create or replace view leads_needing_call as select name, phone, type, score_tier, created_at
  from plumbing_leads where status in ('new','contacted') and created_at < now() - interval '2 days' order by score desc;
create or replace view funnel_30d as select
  count(*) filter (where created_at > now()-interval '30 days') as leads,
  count(*) filter (where booked_at > now()-interval '30 days') as booked,
  count(*) filter (where status in ('quoted','signed','active','complete') and created_at > now()-interval '30 days') as quoted,
  count(*) filter (where status in ('signed','active','complete') and created_at > now()-interval '30 days') as signed
  from plumbing_leads;

-- room sketch from the website planner
alter table plumbing_leads add column if not exists sketch jsonb, add column if not exists sketch_png text;

alter table plumbing_leads add column if not exists sketch_estimate text, add column if not exists sketch_lines text, add column if not exists sketch_3d_png text;

-- hero quick form (project, ZIP, phone only): name/email arrive later, so relax them and add zip + form
alter table plumbing_leads alter column name drop not null, alter column email drop not null;
alter table plumbing_leads add column if not exists zip text, add column if not exists form text;

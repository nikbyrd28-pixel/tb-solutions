-- LSA Shield — intake + audit table for tbsol.net/lsa/
-- One row per shop that runs the "what's the new LSA costing you" calculator / asks for the free audit.
create table if not exists public.lsa_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  -- who
  business        text,
  name            text,
  phone           text,                       -- E.164
  email           text,
  trade           text,                       -- plumbing | hvac | electrical | roofing | other
  city            text,
  -- their LSA situation (from the calculator)
  lsa_status      text,                       -- running | migrated | notice_received | not_started | unsure
  monthly_spend   int,                        -- $ they spend on LSA per month
  lead_cost       int,                        -- $ Google charges per LSA lead in their market
  calls_per_week  int,                        -- LSA calls per week
  missed_pct      int,                        -- % of calls that ring out (0-100)
  -- what we computed for them
  est_missed_calls_mo    numeric,             -- calls/mo that ring out
  est_missed_charges_mo  numeric,             -- $ Google now bills for those (new Oct 1 rule)
  est_lost_jobs_mo       numeric,             -- $ revenue those calls were worth
  est_total_mo           numeric,             -- the headline number shown on the page
  -- pipeline
  status          text not null default 'new',   -- new | contacted | audit_sent | won | lost
  notes           text,
  source          text default 'web',
  utm             text,
  ip              text,
  user_agent      text
);
create index if not exists lsa_leads_created_idx on public.lsa_leads (created_at desc);
alter table public.lsa_leads enable row level security;
-- No anon policy on purpose: writes go through the lsa-intake edge function (service role).
-- Nick reads this in the Supabase dashboard / TB Command for now.

comment on table public.lsa_leads is 'LSA Shield offer: audit requests + computed missed-call cost from tbsol.net/lsa/';

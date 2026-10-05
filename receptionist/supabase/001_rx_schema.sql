-- TB Solutions AI Receptionist ("rx") — core schema
-- One Supabase project serves every trade client. Each client = one rx_businesses row,
-- resolved at call time by the number the caller dialed (rx_businesses.agent_number).

create extension if not exists pgcrypto;

create table if not exists public.rx_businesses (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,                 -- 'dne-contracting'
  name            text not null,                        -- 'D N E Contracting'
  trade           text not null default 'plumbing',     -- plumbing | hvac | electrical | roofing | other
  owner_name      text,
  owner_phone     text not null,                        -- E.164, gets the SMS summaries
  agent_number    text unique,                          -- E.164 Twilio/Vapi number callers reach
  agent_name      text not null default 'Dana',         -- persona name the receptionist uses
  timezone        text not null default 'America/New_York',
  service_zips    text[] not null default '{}',         -- empty = don't screen by zip
  service_area_note text,                               -- 'Pottstown + 30 min: Phoenixville, Boyertown, Limerick…'
  service_fee_cents      int,                           -- standard dispatch / service call fee
  after_hours_fee_cents  int,                           -- nightly/weekend dispatch fee
  free_estimates  boolean not null default true,
  hours           jsonb not null default '{"mon":["07:00","17:00"],"tue":["07:00","17:00"],"wed":["07:00","17:00"],"thu":["07:00","17:00"],"fri":["07:00","17:00"],"sat":null,"sun":null}',
  windows         jsonb not null default '[["07:00","09:00"],["09:00","12:00"],["12:00","15:00"],["15:00","17:00"]]',
  jobs_per_window int not null default 2,               -- capacity per arrival window
  emergency_policy text not null default 'after_hours_dispatch', -- after_hours_dispatch | message_only | transfer
  transfer_number text,                                 -- live-transfer target for emergencies/escalations
  knowledge       text,                                 -- free-form: FAQs, policies, brands serviced, payment types
  vapi_assistant_id text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.rx_services (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.rx_businesses(id) on delete cascade,
  name          text not null,                          -- 'Water heater leak'
  keywords      text[] not null default '{}',           -- {'water heater','leaking tank','no hot water'}
  urgency       text not null default 'standard',       -- emergency | urgent | standard | estimate
  fee_cents     int,                                    -- overrides business service fee when set
  safety_steps  text,                                   -- 'Turn the cold-water valve on top of the tank clockwise…'
  active        boolean not null default true
);
create index if not exists rx_services_business_idx on public.rx_services(business_id);

create table if not exists public.rx_on_call (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.rx_businesses(id) on delete cascade,
  name          text not null,
  phone         text not null,
  days          int[] not null default '{0,1,2,3,4,5,6}', -- 0=Sun … 6=Sat
  priority      int not null default 1
);
create index if not exists rx_on_call_business_idx on public.rx_on_call(business_id);

create table if not exists public.rx_calls (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references public.rx_businesses(id) on delete set null,
  vapi_call_id    text unique,
  caller_phone    text,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_s      int,
  outcome         text,              -- booked | message | transferred | out_of_area | info_only | spam | abandoned
  urgency         text,
  summary         text,
  transcript      text,
  recording_url   text,
  ended_reason    text,
  owner_notified  boolean not null default false,
  caller_texted   boolean not null default false,       -- missed-call text-back sent
  raw             jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists rx_calls_business_idx on public.rx_calls(business_id, created_at desc);

create table if not exists public.rx_jobs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.rx_businesses(id) on delete cascade,
  call_id         uuid references public.rx_calls(id) on delete set null,
  vapi_call_id    text,
  customer_name   text,
  customer_phone  text,
  address         text,
  zip             text,
  issue           text not null,
  service_id      uuid references public.rx_services(id) on delete set null,
  urgency         text not null default 'standard',
  window_start    timestamptz,
  window_end      timestamptz,
  status          text not null default 'scheduled',   -- scheduled | confirmed | en_route | completed | cancelled | no_show
  quoted_fee_cents int,
  notes           text,
  external_ref    text,                                 -- Jobber / Housecall Pro / calendar event id
  customer_texted boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rx_jobs_business_window_idx on public.rx_jobs(business_id, window_start);

create table if not exists public.rx_messages (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.rx_businesses(id) on delete cascade,
  call_id         uuid references public.rx_calls(id) on delete set null,
  caller_name     text,
  caller_phone    text,
  body            text not null,
  callback_pref   text,
  handled         boolean not null default false,
  created_at      timestamptz not null default now()
);

-- updated_at triggers
create or replace function public.rx_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists rx_businesses_touch on public.rx_businesses;
create trigger rx_businesses_touch before update on public.rx_businesses for each row execute function public.rx_touch();
drop trigger if exists rx_jobs_touch on public.rx_jobs;
create trigger rx_jobs_touch before update on public.rx_jobs for each row execute function public.rx_touch();

-- RLS: service role (edge function) only. No anon access to any rx_ table.
alter table public.rx_businesses enable row level security;
alter table public.rx_services   enable row level security;
alter table public.rx_on_call    enable row level security;
alter table public.rx_calls      enable row level security;
alter table public.rx_jobs       enable row level security;
alter table public.rx_messages   enable row level security;

-- Owner dashboard later: a business owner authenticated via Supabase Auth can read their own rows.
-- Mapping table kept tiny so it's easy to grant access per client.
create table if not exists public.rx_business_users (
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'owner',
  primary key (business_id, user_id)
);
alter table public.rx_business_users enable row level security;

create policy rx_bu_self on public.rx_business_users for select to authenticated using (user_id = auth.uid());
create policy rx_biz_owner_read on public.rx_businesses for select to authenticated
  using (id in (select business_id from public.rx_business_users where user_id = auth.uid()));
create policy rx_calls_owner_read on public.rx_calls for select to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()));
create policy rx_jobs_owner_rw on public.rx_jobs for all to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()))
  with check (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()));
create policy rx_messages_owner_rw on public.rx_messages for all to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()))
  with check (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()));
create policy rx_services_owner_read on public.rx_services for select to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()));

-- SMS consent records (web form at /receptionist/sms-consent/ or verbal on the call). Service role only.
create table if not exists public.rx_sms_optins (
  id uuid primary key default gen_random_uuid(),
  phone text not null, name text, business_slug text,
  service_texts boolean not null default false, promo_texts boolean not null default false,
  source text not null default 'web', ip text, user_agent text,
  created_at timestamptz not null default now()
);
alter table public.rx_sms_optins enable row level security;

-- Runtime config read by rx-agent when env vars are not set (Twilio creds, webhook secret). Service role only.
create table if not exists public.rx_config (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.rx_config enable row level security;

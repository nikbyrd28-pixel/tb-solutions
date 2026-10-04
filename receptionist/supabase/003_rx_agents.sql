-- TB Solutions AI Receptionist — many agents per business ("lines")
--
-- 001 gave every business exactly one agent: rx_businesses.agent_number + agent_name.
-- This adds rx_agents, so one business can run as many AI phone agents as it wants —
-- a main line, a booking-only line, an after-hours emergency line, a support line —
-- each with its own number, persona, role, voice, hours and notify phone.
--
-- Every nullable column falls back to the rx_businesses row, so an existing client that
-- gets backfilled into one 'main' agent behaves exactly as it did before.
-- Idempotent: safe to re-run. Run after 001.

create table if not exists public.rx_agents (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.rx_businesses(id) on delete cascade,
  slug            text not null,                        -- 'main' | 'booking' | 'after-hours' | 'support'
  label           text,                                 -- internal name: 'Main line', 'Overflow line'
  role            text not null default 'receptionist',  -- receptionist | booking | emergency | support | overflow | estimates
  agent_name      text not null default 'Dana',         -- persona name the caller hears
  phone_number    text unique,                          -- E.164 number callers dial to reach THIS agent
  vapi_phone_number_id text,
  vapi_assistant_id    text,
  greeting        text,                                 -- overrides the role's first message
  prompt_extra    text,                                 -- extra instructions for this line only
  tools_allow     text[],                               -- null/empty = the role's default tool set
  voice           jsonb,                                -- {provider, voiceId, …} — null = house voice
  model           jsonb,                                -- {provider, model, temperature} — null = house model
  hours           jsonb,                                -- null = business hours (a 24/7 line sets its own)
  windows         jsonb,                                -- null = business arrival windows
  jobs_per_window int,                                  -- null = business capacity
  emergency_policy text,                                -- null = business policy
  transfer_number text,                                 -- null = business transfer_number, then owner_phone
  notify_phone    text,                                 -- who gets THIS line's texts; null = owner_phone
  priority        int not null default 100,             -- lowest active priority = the business's default line
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, slug)
);
create index if not exists rx_agents_business_idx on public.rx_agents(business_id, priority);
create index if not exists rx_agents_number_idx on public.rx_agents(phone_number) where phone_number is not null;

drop trigger if exists rx_agents_touch on public.rx_agents;
create trigger rx_agents_touch before update on public.rx_agents for each row execute function public.rx_touch();

-- Which line handled it. Nullable so legacy rows and unknown numbers still land.
alter table public.rx_calls    add column if not exists agent_id uuid references public.rx_agents(id) on delete set null;
alter table public.rx_jobs     add column if not exists agent_id uuid references public.rx_agents(id) on delete set null;
alter table public.rx_messages add column if not exists agent_id uuid references public.rx_agents(id) on delete set null;
create index if not exists rx_calls_agent_idx    on public.rx_calls(agent_id, created_at desc);
create index if not exists rx_jobs_agent_idx     on public.rx_jobs(agent_id, created_at desc);
create index if not exists rx_messages_agent_idx on public.rx_messages(agent_id, created_at desc);

-- Backfill: every existing business becomes one 'main' receptionist on its current number.
insert into public.rx_agents (business_id, slug, label, role, agent_name, phone_number, vapi_assistant_id, priority)
select b.id, 'main', 'Main line', 'receptionist', b.agent_name, b.agent_number, b.vapi_assistant_id, 1
from public.rx_businesses b
where not exists (select 1 from public.rx_agents a where a.business_id = b.id)
on conflict do nothing;

-- RLS: service role (the edge function) only, same as every other rx_ table.
alter table public.rx_agents enable row level security;
drop policy if exists rx_agents_owner_read on public.rx_agents;
create policy rx_agents_owner_read on public.rx_agents for select to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = auth.uid()));

-- Per-line scoreboard for the owner dashboard: how each agent is earning its airtime.
create or replace view public.rx_agent_stats with (security_invoker = true) as
select a.id as agent_id, a.business_id, a.slug, a.label, a.role, a.agent_name, a.phone_number, a.active,
       count(c.id)                                                        as calls_30d,
       coalesce(sum(c.duration_s), 0)                                     as talk_seconds_30d,
       count(*) filter (where c.outcome = 'booked')                       as booked_30d,
       count(*) filter (where c.outcome = 'message')                      as messages_30d,
       count(*) filter (where c.outcome in ('abandoned', 'spam'))         as dropped_30d,
       max(c.created_at)                                                  as last_call_at
from public.rx_agents a
left join public.rx_calls c on c.agent_id = a.id and c.created_at > now() - interval '30 days'
group by a.id;

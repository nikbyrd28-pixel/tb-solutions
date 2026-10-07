-- Missed-call log for D N E Contracting (written by n8n/dne-missed-call.json with the service key).
create table if not exists public.dne_missed_calls (
  id uuid primary key default gen_random_uuid(),
  call_sid text unique,
  caller text not null,
  caller_city text,
  forwarded_from text,          -- set when the call came via Nicole's cell forwarding
  dial_status text,             -- no-answer | busy | failed | canceled (null when forwarded)
  texted_caller boolean default false,
  alerted text[] default '{}',
  voicemail_text text,
  recording_url text,
  called_back_at timestamptz,   -- Nicole/Nick mark this from HQ when they return the call
  created_at timestamptz default now()
);
alter table public.dne_missed_calls enable row level security;   -- service role only; no public policies
create index if not exists dne_missed_calls_created_idx on public.dne_missed_calls (created_at desc);

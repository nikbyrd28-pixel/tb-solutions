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

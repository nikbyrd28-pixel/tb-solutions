-- Remodel Planner ($697 build + $67/mo, tbsol.net/planner/) — the delivery behind the offer.
--
-- One planner app, many plumbers. Each shop is a row in planner_clients; the app at
-- tbsol.net/planner/app/?c=<slug> (or a custom domain mapped in `hostnames`) pulls brand, services
-- and price ranges from that row through the anon RPC planner_config(). Every finished flow lands in
-- planner_leads through planner_lead_submit() (the ONLY insert path; it checks the slug is live),
-- called by edge fn planner-intake, which then texts + emails the owner and texts Nick on a shop's
-- first lead. HQ → Planner manages it all through the hq_planner_* RPCs (admin only).
--
-- Tables   planner_clients, planner_leads
-- Bucket   planner-uploads (private; HQ reads through signed URLs)
-- Anon     planner_config(slug, host), planner_lead_submit(jsonb)
-- Admin    hq_planner(), hq_planner_client_create(jsonb), hq_planner_client_save(uuid, jsonb),
--          hq_planner_leads(uuid, int), hq_planner_lead_set(uuid, text, text)
--
-- Needs hq/supabase/001_hq.sql (hq_admins, is_hq_admin). Idempotent: safe to run twice.
-- Seeds D N E Contracting as slug `dne` from dne-contracting/index.html (on conflict do nothing,
-- so edits made in HQ survive a re-run). dnecontracting.com itself is NOT touched.

create extension if not exists pgcrypto;

-- ---------- tenants ----------
create table if not exists public.planner_clients (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  business_name  text not null,
  owner_name     text,
  phone          text,                          -- shown on the page, "(484) 939-8535"
  email          text,                          -- shown on the page
  logo_url       text,                          -- blank = business name in text
  primary_color  text not null default '#B8322B' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  service_area   text,                          -- plain words, shown under the header
  license        text,                          -- "PA HIC #PA096110", shown in the footer when set
  website_url    text,                          -- "back to site" link
  services       jsonb not null default '[]',   -- [{key,label,blurb,time,scopes:[{key,label,low,high}]}]
  notify_phone   text,                          -- where the lead text goes (E.164)
  notify_email   text,                          -- where the lead email goes
  intake         jsonb not null default '{}',   -- see planner_default_intake()
  hostnames      text[] not null default '{}',  -- custom domains that resolve to this tenant
  owner_user_id  uuid references auth.users(id) on delete set null,  -- owner login, reads own leads
  active         boolean not null default true,
  first_lead_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists planner_clients_hostnames on public.planner_clients using gin (hostnames);

-- ---------- leads ----------
create table if not exists public.planner_leads (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.planner_clients(id) on delete cascade,
  client_slug   text not null,
  name          text not null,
  phone         text,
  email         text,
  town          text,
  zip           text,
  project_type  text,                           -- services[].key
  project_label text,
  scope         text,                           -- scopes[].key
  scope_label   text,
  timeline      text,
  budget        text,
  notes         text,
  contact_pref  text,
  sms_consent   boolean not null default false,
  est_low       int,
  est_high      int,
  score         int not null default 0,
  score_tier    text,
  answers       jsonb not null default '{}',    -- every answer as sent, for anything not in a column
  attachments   jsonb not null default '[]',    -- [{path,name,size,type}] in bucket planner-uploads
  source_url    text,
  utm           jsonb,
  ip            text,
  user_agent    text,
  status        text not null default 'new' check (status in ('new','contacted','booked','quoted','won','lost')),
  owner_notes   text,
  created_at    timestamptz not null default now()
);
create index if not exists planner_leads_client on public.planner_leads(client_id, created_at desc);

alter table public.planner_clients enable row level security;
alter table public.planner_leads   enable row level security;
revoke all on table public.planner_clients, public.planner_leads from anon;
revoke insert, update, delete on table public.planner_clients, public.planner_leads from authenticated;

-- Owner reads own; HQ admins read all. Nobody writes through the table directly (RPCs only).
drop policy if exists planner_clients_owner on public.planner_clients;
create policy planner_clients_owner on public.planner_clients for select to authenticated
  using (owner_user_id = auth.uid() or public.is_hq_admin());
drop policy if exists planner_leads_owner on public.planner_leads;
create policy planner_leads_owner on public.planner_leads for select to authenticated
  using (public.is_hq_admin() or client_id in (select id from public.planner_clients where owner_user_id = auth.uid()));

-- ---------- uploads (private bucket; the edge fn writes with the service role, HQ/owner read via signed URLs) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planner-uploads', 'planner-uploads', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists planner_uploads_read on storage.objects;
create policy planner_uploads_read on storage.objects for select to authenticated
  using (bucket_id = 'planner-uploads' and (public.is_hq_admin()
         or split_part(name, '/', 1) in (select slug from public.planner_clients where owner_user_id = auth.uid())));

-- ---------- defaults (copied onto every new tenant; DNE's numbers) ----------
create or replace function public.planner_default_intake() returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'show_estimate', true,
    'allow_upload', true,
    'ask_town', true,
    'ask_zip', false,
    'headline', 'Tell us about your project',
    'intro', 'A few quick questions so we come prepared. No obligation.',
    'submit_label', 'Send my project',
    'thanks', 'Got it. Expect a text or call within one business day.',
    'timelines', jsonb_build_array(
      jsonb_build_object('key','asap','label','Ready soon'),
      jsonb_build_object('key','3months','label','Next few months'),
      jsonb_build_object('key','thisyear','label','Sometime this year'),
      jsonb_build_object('key','unsure','label','Just thinking')),
    'budgets', jsonb_build_array(
      jsonb_build_object('key','5-10k','label','Under $10k'),
      jsonb_build_object('key','10-25k','label','$10-25k'),
      jsonb_build_object('key','25-50k','label','$25-50k'),
      jsonb_build_object('key','50k+','label','$50k+'),
      jsonb_build_object('key','unsure','label','Not sure yet')),
    'autoreply', false)
$$;

-- Price ranges come from the fixture cost table on dnecontracting.com (room sketch `I` + `ROOM`),
-- rolled up per scope. Edit per tenant in HQ → Planner.
create or replace function public.planner_default_services() returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select '[
    {"key":"kitchen","label":"Kitchen","blurb":"Full kitchen remodels, from moving the sink and gas line to the last cabinet pull.","time":"Usually 3-6 weeks","scopes":[
      {"key":"refresh","label":"Refresh: new sink, faucet, counters, same layout","low":3500,"high":10000},
      {"key":"mid","label":"New cabinets, counters and floors, same layout","low":12000,"high":35000},
      {"key":"full","label":"New layout: island, moved plumbing or gas","low":30000,"high":75000}]},
    {"key":"bathroom","label":"Bathroom","blurb":"Tub-to-shower conversions, full gut renovations, or a fresh update.","time":"Usually 2-4 weeks","scopes":[
      {"key":"refresh","label":"Refresh: vanity, toilet, faucets, paint","low":2500,"high":7000},
      {"key":"mid","label":"New shower or tub, vanity and tile, same layout","low":8000,"high":22000},
      {"key":"full","label":"Full gut with a new layout","low":18000,"high":45000}]},
    {"key":"basement","label":"Basement","blurb":"Finished basements, bathrooms and laundry, with the water problem fixed first.","time":"Usually 3-6 weeks","scopes":[
      {"key":"finish","label":"Finish the space: framing, drywall, floors, lights","low":15000,"high":35000},
      {"key":"bath","label":"Finished space plus a bathroom or laundry","low":30000,"high":60000},
      {"key":"full","label":"Full living space: bath, wet bar, egress","low":45000,"high":90000}]},
    {"key":"repair","label":"Plumbing repair or water heater","blurb":"Leaks, fixtures, drains, tank and tankless water heaters.","time":"Most repairs same or next day","scopes":[
      {"key":"fix","label":"Leak, faucet, toilet or drain","low":150,"high":900},
      {"key":"heater","label":"Water heater replacement","low":1600,"high":5500},
      {"key":"repipe","label":"Repipe or bigger plumbing job","low":4000,"high":15000}]}
  ]'::jsonb
$$;

create or replace function public.planner_clients_stamp() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists planner_clients_stamp on public.planner_clients;
create trigger planner_clients_stamp before update on public.planner_clients
  for each row execute function public.planner_clients_stamp();

-- ---------- helpers ----------
create or replace function public.planner_phone_e164(p text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when length(d) = 10 then '+1' || d
              when length(d) = 11 and left(d, 1) = '1' then '+' || d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

-- What the public page is allowed to see. Never the notify fields or the owner id.
create or replace function public.planner_public_json(c public.planner_clients) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'slug', c.slug, 'business_name', c.business_name, 'owner_name', c.owner_name,
    'phone', c.phone, 'email', c.email, 'logo_url', c.logo_url, 'primary_color', c.primary_color,
    'service_area', c.service_area, 'license', c.license, 'website_url', c.website_url,
    'services', c.services, 'intake', public.planner_default_intake() || c.intake)
$$;

-- ---------- anon: read config ----------
create or replace function public.planner_config(p_slug text default null, p_host text default null)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select public.planner_public_json(c) from public.planner_clients c
  where c.active
    and ((p_slug is not null and c.slug = lower(trim(p_slug)))
      or (p_slug is null and p_host is not null and lower(regexp_replace(trim(p_host), '^www\.', '')) = any(c.hostnames)))
  limit 1
$$;
revoke all on function public.planner_config(text, text) from public;
grant execute on function public.planner_config(text, text) to anon, authenticated, service_role;

-- ---------- anon: the one insert path ----------
-- Validates the slug is live, caps every field, recomputes the estimate from the tenant's own ranges
-- and the score from the same weights dnecontracting.com uses. Returns {ok,id,first_lead} or {ok:false,error}.
create or replace function public.planner_lead_submit(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c      public.planner_clients;
  v_name text := left(trim(coalesce(p->>'name','')), 120);
  v_phone text := public.planner_phone_e164(p->>'phone');
  v_email text := nullif(left(lower(trim(coalesce(p->>'email',''))), 160), '');
  v_type text := nullif(left(trim(coalesce(p->>'project_type','')), 40), '');
  v_scope text := nullif(left(trim(coalesce(p->>'scope','')), 40), '');
  v_svc  jsonb; v_sc jsonb;
  v_low int; v_high int;
  v_score int := 0; v_tier text;
  v_first boolean := false;
  v_id uuid;
  v_timeline text := nullif(left(trim(coalesce(p->>'timeline','')), 40), '');
  v_budget text := nullif(left(trim(coalesce(p->>'budget','')), 40), '');
begin
  if coalesce(p->>'_honey','') <> '' then return jsonb_build_object('ok', true, 'id', null); end if;  -- bot
  select * into c from public.planner_clients where slug = lower(trim(coalesce(p->>'slug',''))) and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'This planner is not live.'); end if;
  if length(v_name) < 2 then return jsonb_build_object('ok', false, 'error', 'What should we call you?'); end if;
  if v_phone is null and coalesce(p->>'phone','') <> '' then return jsonb_build_object('ok', false, 'error', 'That phone number needs 10 digits.'); end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'That email does not look right.'); end if;
  if v_phone is null and v_email is null then return jsonb_build_object('ok', false, 'error', 'Leave a phone number or an email so we can reach you.'); end if;

  select s into v_svc from jsonb_array_elements(c.services) s where s->>'key' = v_type limit 1;
  if v_svc is not null and v_scope is not null then
    select s into v_sc from jsonb_array_elements(coalesce(v_svc->'scopes','[]')) s where s->>'key' = v_scope limit 1;
  end if;
  v_low  := (v_sc->>'low')::int; v_high := (v_sc->>'high')::int;

  -- same weights as dnecontracting.com's planner
  v_score := case v_timeline when 'asap' then 40 when '3months' then 30 when 'thisyear' then 20 when 'unsure' then 10 else 0 end
           + case v_budget when '50k+' then 30 when '25-50k' then 25 when '10-25k' then 15 when '5-10k' then 5 when 'unsure' then 8 else 0 end
           + case v_type when 'kitchen' then 20 when 'bathroom' then 15 when 'basement' then 10 when 'repair' then 5 else 10 end;
  v_tier := case when v_score >= 80 then 'URGENT' when v_score >= 60 then 'HOT' when v_score >= 40 then 'WARM' else 'COLD' end;

  insert into public.planner_leads (client_id, client_slug, name, phone, email, town, zip, project_type, project_label, scope, scope_label,
      timeline, budget, notes, contact_pref, sms_consent, est_low, est_high, score, score_tier, answers, source_url, utm, ip, user_agent)
  values (c.id, c.slug, v_name, v_phone, v_email,
      nullif(left(trim(coalesce(p->>'town','')), 80), ''), nullif(left(regexp_replace(coalesce(p->>'zip',''), '\D', '', 'g'), 5), ''),
      v_type, coalesce(v_svc->>'label', v_type), v_scope, coalesce(v_sc->>'label', v_scope),
      v_timeline, v_budget, nullif(left(trim(coalesce(p->>'notes','')), 2000), ''),
      nullif(left(trim(coalesce(p->>'contact_pref','')), 20), ''),
      coalesce((p->>'sms_consent')::boolean, false) and v_phone is not null,
      v_low, v_high, v_score, v_tier,
      coalesce(p->'answers', '{}'::jsonb), left(p->>'source_url', 500), p->'utm', left(p->>'ip', 60), left(p->>'user_agent', 300))
  returning id into v_id;

  update public.planner_clients set first_lead_at = now() where id = c.id and first_lead_at is null returning true into v_first;
  return jsonb_build_object('ok', true, 'id', v_id, 'first_lead', coalesce(v_first, false),
    'est_low', v_low, 'est_high', v_high, 'score', v_score, 'score_tier', v_tier);
end $$;
revoke all on function public.planner_lead_submit(jsonb) from public;
grant execute on function public.planner_lead_submit(jsonb) to anon, authenticated, service_role;

-- Attach the uploaded files to a lead (edge fn only, after it has written them to the bucket).
create or replace function public.planner_lead_attach(p_id uuid, p_files jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.planner_leads set attachments = coalesce(p_files, '[]'::jsonb) where id = p_id;
  return found;
end $$;
revoke all on function public.planner_lead_attach(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.planner_lead_attach(uuid, jsonb) to service_role;

-- ---------- HQ (admin only) ----------
create or replace function public.hq_planner()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_hq_admin() then jsonb_build_object(
    'clients', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'business_name', c.business_name, 'owner_name', c.owner_name, 'phone', c.phone, 'email', c.email,
        'logo_url', c.logo_url, 'primary_color', c.primary_color, 'service_area', c.service_area, 'license', c.license, 'website_url', c.website_url,
        'services', c.services, 'notify_phone', c.notify_phone, 'notify_email', c.notify_email, 'intake', public.planner_default_intake() || c.intake,
        'hostnames', c.hostnames, 'owner_user_id', c.owner_user_id, 'active', c.active, 'first_lead_at', c.first_lead_at,
        'created_at', c.created_at, 'updated_at', c.updated_at,
        'leads', (select count(*) from public.planner_leads l where l.client_id = c.id),
        'leads_new', (select count(*) from public.planner_leads l where l.client_id = c.id and l.status = 'new'),
        'last_lead_at', (select max(created_at) from public.planner_leads l where l.client_id = c.id)
      ) order by c.active desc, c.created_at), '[]') from public.planner_clients c),
    'stats', jsonb_build_object(
      'on', (select count(*) from public.planner_clients where active),
      'month', (select count(*) from public.planner_leads where created_at > date_trunc('month', now())),
      'new', (select count(*) from public.planner_leads where status = 'new'))
  ) else null end
$$;

create or replace function public.hq_planner_leads(p_client uuid default null, p_days int default 90)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'client_id', l.client_id, 'client_slug', l.client_slug, 'business', c.business_name,
      'name', l.name, 'phone', l.phone, 'email', l.email, 'town', l.town, 'zip', l.zip,
      'project_label', l.project_label, 'scope_label', l.scope_label, 'timeline', l.timeline, 'budget', l.budget,
      'notes', l.notes, 'contact_pref', l.contact_pref, 'sms_consent', l.sms_consent,
      'est_low', l.est_low, 'est_high', l.est_high, 'score', l.score, 'score_tier', l.score_tier,
      'attachments', l.attachments, 'source_url', l.source_url, 'status', l.status, 'owner_notes', l.owner_notes, 'created_at', l.created_at
    ) order by l.created_at desc), '[]')
    from public.planner_leads l join public.planner_clients c on c.id = l.client_id
    where (p_client is null or l.client_id = p_client) and l.created_at > now() - make_interval(days => p_days))
  else null end
$$;

-- "+ New client": one row with DNE's services and intake defaults; everything else from p.
create or replace function public.hq_planner_client_create(p jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_slug text; v_services jsonb; v_intake jsonb;
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  if nullif(trim(coalesce(p->>'business_name','')),'') is null then raise exception 'business_name required'; end if;
  v_slug := lower(regexp_replace(trim(coalesce(nullif(p->>'slug',''), p->>'business_name')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 2 then raise exception 'slug too short'; end if;
  if exists (select 1 from public.planner_clients where slug = v_slug) then raise exception 'slug % is taken', v_slug; end if;
  select services, intake into v_services, v_intake from public.planner_clients where slug = 'dne';
  insert into public.planner_clients (slug, business_name, owner_name, phone, email, logo_url, primary_color, service_area, license, website_url,
      services, notify_phone, notify_email, intake, hostnames, active)
  values (v_slug, trim(p->>'business_name'), nullif(p->>'owner_name',''), nullif(p->>'phone',''), nullif(p->>'email',''),
      nullif(p->>'logo_url',''), coalesce(nullif(p->>'primary_color',''), '#B8322B'), nullif(p->>'service_area',''), nullif(p->>'license',''), nullif(p->>'website_url',''),
      coalesce(p->'services', v_services, public.planner_default_services()),
      coalesce(public.planner_phone_e164(p->>'notify_phone'), public.planner_phone_e164(p->>'phone')),
      coalesce(nullif(p->>'notify_email',''), nullif(p->>'email','')),
      coalesce(p->'intake', v_intake, public.planner_default_intake()),
      coalesce((select array_agg(lower(regexp_replace(trim(h), '^www\.', ''))) from jsonb_array_elements_text(coalesce(p->'hostnames','[]')) h where trim(h) <> ''), '{}'),
      coalesce((p->>'active')::boolean, true))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_planner_client_save(p_id uuid, p jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  update public.planner_clients set
    slug          = coalesce(nullif(lower(trim(p->>'slug')),''), slug),
    business_name = coalesce(nullif(trim(p->>'business_name'),''), business_name),
    owner_name    = case when p ? 'owner_name' then nullif(p->>'owner_name','') else owner_name end,
    phone         = case when p ? 'phone' then nullif(p->>'phone','') else phone end,
    email         = case when p ? 'email' then nullif(p->>'email','') else email end,
    logo_url      = case when p ? 'logo_url' then nullif(p->>'logo_url','') else logo_url end,
    primary_color = coalesce(nullif(p->>'primary_color',''), primary_color),
    service_area  = case when p ? 'service_area' then nullif(p->>'service_area','') else service_area end,
    license       = case when p ? 'license' then nullif(p->>'license','') else license end,
    website_url   = case when p ? 'website_url' then nullif(p->>'website_url','') else website_url end,
    services      = case when p ? 'services' and jsonb_typeof(p->'services') = 'array' then p->'services' else services end,
    notify_phone  = case when p ? 'notify_phone' then public.planner_phone_e164(p->>'notify_phone') else notify_phone end,
    notify_email  = case when p ? 'notify_email' then nullif(lower(trim(p->>'notify_email')),'') else notify_email end,
    intake        = case when p ? 'intake' and jsonb_typeof(p->'intake') = 'object' then intake || (p->'intake') else intake end,
    hostnames     = case when p ? 'hostnames' then coalesce((select array_agg(lower(regexp_replace(trim(h), '^www\.', ''))) from jsonb_array_elements_text(p->'hostnames') h where trim(h) <> ''), '{}') else hostnames end,
    owner_user_id = case when p ? 'owner_user_id' then nullif(p->>'owner_user_id','')::uuid else owner_user_id end,
    active        = coalesce((p->>'active')::boolean, active)
  where id = p_id;
  return found;
end $$;

create or replace function public.hq_planner_lead_set(p_id uuid, p_status text default null, p_notes text default null)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  update public.planner_leads set status = coalesce(p_status, status), owner_notes = coalesce(p_notes, owner_notes) where id = p_id;
  return found;
end $$;

revoke all on function public.hq_planner(), public.hq_planner_leads(uuid, int), public.hq_planner_client_create(jsonb),
  public.hq_planner_client_save(uuid, jsonb), public.hq_planner_lead_set(uuid, text, text) from public, anon;
grant execute on function public.hq_planner(), public.hq_planner_leads(uuid, int), public.hq_planner_client_create(jsonb),
  public.hq_planner_client_save(uuid, jsonb), public.hq_planner_lead_set(uuid, text, text) to authenticated;
revoke all on function public.planner_default_intake(), public.planner_default_services(), public.planner_public_json(public.planner_clients),
  public.planner_phone_e164(text) from public, anon;

-- ---------- seed: D N E Contracting (values from dne-contracting/index.html window.DNE) ----------
insert into public.planner_clients (slug, business_name, owner_name, phone, email, primary_color, service_area, license, website_url,
    services, notify_phone, notify_email, intake, hostnames, active)
values ('dne', 'D N E Contracting', 'Nicole', '(484) 939-8535', 'hello@dnecontracting.com', '#B8322B',
    'Chester and Montgomery counties and the 422 corridor, plus Bucks, Delaware and Philadelphia counties and nearby South Jersey',
    'PA HIC #PA096110', 'https://www.dnecontracting.com/',
    public.planner_default_services(), '+14849398535', 'hello@dnecontracting.com',
    public.planner_default_intake() || '{"headline":"Tell us about your space","intro":"A few quick questions so we come prepared. No obligation.","submit_label":"Book my free consultation","thanks":"Thanks. Expect a text or call within one business day. Nothing to decide on the spot."}'::jsonb,
    '{}', true)
on conflict (slug) do nothing;

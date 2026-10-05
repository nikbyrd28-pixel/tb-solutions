-- ============================================================================
-- TB COMMAND — MULTI-TENANT SECURITY BLUEPRINT (Phase 4)
-- ============================================================================
-- Shared-database, single-schema multi-tenancy. Every tenant-scoped table
-- carries organization_id; isolation is enforced by RLS that reads the
-- caller's organization/role from CUSTOM JWT CLAIMS (app_metadata), so no
-- per-row joins are needed during policy evaluation.
--
-- ⚠️ DO NOT run this on the live tbsol.net database today. The current app
-- uses the single-tenant schema (supabase-schema.sql). This file is the
-- migration target for when TB Solutions adds team members or multiple
-- agency tenants. Run it on a fresh project (or after migrating app code).
--
-- NOTE ON CLAIMS: app_metadata is embedded into the JWT when a token is
-- issued. After changing a user's role/org, they must sign out/in (or the
-- token must refresh) before new claims take effect.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. ROLE ENUM
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum
    ('super_admin','agency_admin','team_member','client_user');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. CORE TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business        text,
  contact_name    text,
  email           text,
  phone           text,
  status          text not null default 'onboarding',
  created_at      timestamptz not null default now()
);

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  user_role       public.user_role not null default 'client_user',
  client_id       uuid references public.clients(id) on delete set null,
  full_name       text,
  email           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  title           text not null,
  status          text not null default 'planning',
  due             date,
  created_at      timestamptz not null default now()
);

create table if not exists public.ai_generations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by    uuid references auth.users(id) on delete set null,
  kind            text not null,           -- copy | image | research | ...
  prompt          text,
  result          text,
  created_at      timestamptz not null default now()
);

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  amount_cents    bigint not null check (amount_cents >= 0),
  currency        text not null default 'usd',
  status          text not null default 'draft',   -- draft|sent|paid|void
  stripe_link     text,
  due             date,
  created_at      timestamptz not null default now()
);

-- Tenant-scoped indexes (every RLS check filters on these)
create index if not exists clients_org_idx     on public.clients(organization_id);
create index if not exists profiles_org_idx    on public.profiles(organization_id);
create index if not exists projects_org_idx    on public.projects(organization_id);
create index if not exists projects_client_idx on public.projects(client_id);
create index if not exists ai_org_idx          on public.ai_generations(organization_id);
create index if not exists invoices_org_idx    on public.invoices(organization_id);
create index if not exists invoices_client_idx on public.invoices(client_id);

-- ---------------------------------------------------------------------------
-- 2. JWT CLAIM SYNC — profiles → auth.users.raw_app_meta_data
-- ---------------------------------------------------------------------------
-- Runs with definer rights so it may write auth.users. Locked search_path.
create or replace function public.sync_user_claims()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'organization_id', new.organization_id,
              'user_role',       new.user_role,
              'client_id',       new.client_id
            )
   where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_user_claims() from public, anon, authenticated;

drop trigger if exists profiles_sync_claims on public.profiles;
create trigger profiles_sync_claims
  after insert or update of organization_id, user_role, client_id
  on public.profiles
  for each row execute function public.sync_user_claims();

-- ---------------------------------------------------------------------------
-- 3. CLAIM HELPERS — instantaneous, no table access
-- ---------------------------------------------------------------------------
-- STABLE + parameterless: the planner evaluates once per statement when the
-- policy wraps them as (select fn()), instead of once per row.
create or replace function public.get_auth_org_id()
returns uuid
language sql stable
as $$
  select nullif(
    ((current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'organization_id'), ''
  )::uuid;
$$;

create or replace function public.get_auth_role()
returns text
language sql stable
as $$
  select coalesce(
    ((current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'user_role'), 'client_user'
  );
$$;

create or replace function public.get_auth_client_id()
returns uuid
language sql stable
as $$
  select nullif(
    ((current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'client_id'), ''
  )::uuid;
$$;

grant execute on function
  public.get_auth_org_id(), public.get_auth_role(), public.get_auth_client_id()
to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.projects       enable row level security;
alter table public.ai_generations enable row level security;
alter table public.invoices       enable row level security;

alter table public.organizations  force row level security;
alter table public.profiles       force row level security;
alter table public.clients        force row level security;
alter table public.projects       force row level security;
alter table public.ai_generations force row level security;
alter table public.invoices       force row level security;

-- ======================= organizations =======================
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or id = (select public.get_auth_org_id())
);

drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert to authenticated
with check ( (select public.get_auth_role()) = 'super_admin' );

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

drop policy if exists org_delete on public.organizations;
create policy org_delete on public.organizations for delete to authenticated
using ( (select public.get_auth_role()) = 'super_admin' );

-- ========================= profiles ==========================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or id = (select auth.uid())
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
  -- self-service first insert: own row, no org claim yet, lowest role
  or ( id = (select auth.uid())
       and (select public.get_auth_org_id()) is null
       and user_role = 'client_user' )
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
  or id = (select auth.uid())
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
  -- self-update may not escalate role or move org (must match own JWT)
  or ( id = (select auth.uid())
       and user_role::text = (select public.get_auth_role())
       and organization_id is not distinct from (select public.get_auth_org_id()) )
);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

-- ========================== clients ==========================
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
  or ( organization_id = (select public.get_auth_org_id())
       and id = (select public.get_auth_client_id()) )   -- client sees own record
);

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for insert to authenticated
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

-- ========================= projects ==========================
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
  or ( organization_id = (select public.get_auth_org_id())
       and client_id = (select public.get_auth_client_id()) ) -- client sees own projects
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

-- ====================== ai_generations =======================
drop policy if exists ai_select on public.ai_generations;
create policy ai_select on public.ai_generations for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists ai_insert on public.ai_generations;
create policy ai_insert on public.ai_generations for insert to authenticated
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists ai_update on public.ai_generations;
create policy ai_update on public.ai_generations for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists ai_delete on public.ai_generations;
create policy ai_delete on public.ai_generations for delete to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

-- ========================= invoices ==========================
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
  or ( organization_id = (select public.get_auth_org_id())
       and client_id = (select public.get_auth_client_id()) ) -- explicit client only
);

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
)
with check (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) in ('agency_admin','team_member') )
);

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete to authenticated
using (
  (select public.get_auth_role()) = 'super_admin'
  or ( organization_id = (select public.get_auth_org_id())
       and (select public.get_auth_role()) = 'agency_admin' )
);

-- ============================================================================
-- MIGRATION NOTES
-- 1) service_role bypasses RLS (BYPASSRLS) — server-side jobs/n8n unaffected.
-- 2) FORCE RLS means even the table owner obeys policies — deliberate.
-- 3) All policies wrap helpers as (select fn()) so Postgres evaluates the
--    claim once per statement (InitPlan), not per row — the no-join fast path.
-- 4) Changing a user's role/org updates app_metadata via trigger, but their
--    ACTIVE JWT keeps old claims until refresh. For instant revocation add a
--    profiles-based check to sensitive policies (costs a join) or shorten
--    JWT expiry.
-- 5) Seed order: organizations → clients → profiles (trigger stamps claims).
-- ============================================================================

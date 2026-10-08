-- Work: client projects inside HQ, each pre-loaded with the Google Rank Fix playbook.
--
-- One tap in HQ → Work → "+ New client" creates a project and copies every playbook step
-- into it (logo, SEO site, review activation, NAP cleanup, trust links, Apple Maps, hours,
-- GBP about tab, review replies…). Nick taps a step to move it todo → doing → done / n/a,
-- writes a one-line finding per step, and the client sees it all on a read-only audit page
-- at tbsol.net/audit/?t=<share_token> — the same audit becomes the sales pitch.
--
-- Run after 012_hq_finder.sql. Idempotent.

create extension if not exists pgcrypto;

-- ---------- the playbook (editable, seeded once) ----------
create table if not exists public.hq_playbook (
  key        text primary key,
  grp        text not null,              -- Brand / Website / Reviews / Listings / Google profile
  label      text not null,              -- what the step is
  how        text not null default '',   -- how we do it / why it matters (shown to the client)
  ord        int  not null default 100,
  active     boolean not null default true
);

insert into public.hq_playbook (key, grp, label, how, ord) values
  ('logo',          'Brand',          'Premium logo, drawn from scratch',                 '45% of consumers distrust a visibly AI-made brand. We draw a clean mark off the business name so the profile, truck and site all match.', 10),
  ('site',          'Website',        'New SEO-built website',                             'Fast, mobile-first, one page per service, real title tag, H1 that matches the Google Business Profile category, name-address-phone identical to Google.', 20),
  ('site_form',     'Website',        'Interactive quote form',                            'A step-by-step form gets finished far more often than a blank box. Every submission texts the owner.', 21),
  ('site_map',      'Website',        'Google Map embed + schema markup on every page',    'Map embed uses the real HTML from Google. LocalBusiness + Service schema so Google and AI crawlers read the business correctly.', 22),
  ('site_index',    'Website',        'sitemap.xml, robots.txt, llms.txt',                 'Shipped on every build so the site is indexable by Google and readable by AI search.', 23),
  ('reviews_count', 'Reviews',        'Review count vs. competitors',                      'Fewer than 10 Google reviews makes the profile invisible in the map pack. We benchmark against the top 3 in the area.', 30),
  ('reviews_camp',  'Reviews',        'Review activation campaign',                        'A list of 10+ past customers gets a personal text with their name on a banner photo, not a generic blast. Works in proportion to how many contacts there are.', 31),
  ('reviews_reply', 'Reviews',        'Reply to every review',                             'Even one unanswered review counts against the profile. All replies written and posted.', 32),
  ('nap',           'Listings',       'NAP consistency (name, address, phone)',            'Multiple phone numbers or spellings found online for the same business confuse Google. Cleaned up across Google Maps, Yelp, Apple Maps and the big directories.', 40),
  ('nap_name',      'Listings',       'Business name identical everywhere',                '"Inc." on Google but not on Yelp is a mismatch. One exact spelling on every listing.', 41),
  ('address',       'Listings',       'Hide a home / apartment address',                   'A public residential address hurts trust and can get the profile flagged. Set as a service-area business with the address hidden.', 42),
  ('hours',         'Listings',       'One set of hours',                                  'Two different hour sets across Google and directories hurts ranking. One truth, pushed everywhere.', 43),
  ('apple',         'Listings',       'Claim Apple Maps',                                  'Unclaimed Apple Maps means every iPhone user sees whatever Apple guessed. Claimed, verified, matched to Google.', 44),
  ('trust',         'Listings',       'Local trust links',                                 'Better Business Bureau, Chamber of Commerce, local sponsorships, supplier directories. These are the links that move a local profile up.', 45),
  ('gbp_about',     'Google profile', 'About tab filled out',                              'Missing About, services and attributes leave ranking signal on the table. Every field completed with the right keywords.', 50),
  ('gbp_cat',       'Google profile', 'Primary category + services matched to the site',   'The site H1 and service pages mirror the Google Business Profile category so the two confirm each other.', 51),
  ('gbp_heat',      'Google profile', 'Map-pack visibility heatmap (before / after)',      'Where the business shows up in the map pack across the service area. Re-run after the fix so the client sees the lift.', 52)
on conflict (key) do nothing;

-- ---------- projects ----------
create table if not exists public.hq_projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  business_id  uuid references public.rx_businesses(id) on delete set null,
  trade        text,
  town         text,
  owner_name   text,
  phone        text,
  email        text,
  website      text,
  gbp_url      text,
  status       text not null default 'audit' check (status in ('audit','pitched','active','done','lost')),
  notes        text,
  share_token  text not null unique default encode(gen_random_bytes(9),'hex'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.hq_project_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.hq_projects(id) on delete cascade,
  key         text,
  grp         text not null,
  label       text not null,
  how         text not null default '',
  ord         int not null default 100,
  status      text not null default 'todo' check (status in ('todo','doing','done','na')),
  finding     text,                       -- what we found (shown to the client)
  updated_at  timestamptz not null default now()
);
create index if not exists hq_project_items_project on public.hq_project_items(project_id, ord);

alter table public.hq_playbook enable row level security;
alter table public.hq_projects enable row level security;
alter table public.hq_project_items enable row level security;
-- no policies: everything goes through the SECURITY DEFINER functions below.

-- ---------- RPCs (admin) ----------
create or replace function public.hq_playbook()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin()
    then (select coalesce(jsonb_agg(to_jsonb(p) order by ord), '[]') from public.hq_playbook p where active)
    else null end
$$;

create or replace function public.hq_projects()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'trade', p.trade, 'town', p.town, 'status', p.status,
      'phone', p.phone, 'website', p.website, 'gbp_url', p.gbp_url, 'share_token', p.share_token,
      'business_id', p.business_id, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'total', (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status <> 'na'),
      'done',  (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status = 'done'),
      'doing', (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status = 'doing')
    ) order by case p.status when 'active' then 0 when 'audit' then 1 when 'pitched' then 2 when 'done' then 3 else 4 end, p.updated_at desc), '[]')
    from public.hq_projects p)
  else null end
$$;

create or replace function public.hq_project(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select jsonb_build_object(
      'project', to_jsonb(p),
      'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.ord), '[]') from public.hq_project_items i where i.project_id = p.id)
    ) from public.hq_projects p where p.id = p_id)
  else null end
$$;

-- One tap: create the project and copy every active playbook step into it.
create or replace function public.hq_project_create(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if nullif(trim(coalesce(p->>'name','')),'') is null then raise exception 'name required'; end if;
  insert into public.hq_projects (name, trade, town, owner_name, phone, email, website, gbp_url, business_id, notes)
  values (trim(p->>'name'), nullif(p->>'trade',''), nullif(p->>'town',''), nullif(p->>'owner_name',''),
          nullif(p->>'phone',''), nullif(p->>'email',''), nullif(p->>'website',''), nullif(p->>'gbp_url',''),
          nullif(p->>'business_id','')::uuid, nullif(p->>'notes',''))
  returning id into v_id;
  insert into public.hq_project_items (project_id, key, grp, label, how, ord)
    select v_id, key, grp, label, how, ord from public.hq_playbook where active;
  return v_id;
end $$;

create or replace function public.hq_project_save(p_id uuid, p jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update public.hq_projects set
    name       = coalesce(nullif(trim(p->>'name'),''), name),
    trade      = case when p ? 'trade' then nullif(p->>'trade','') else trade end,
    town       = case when p ? 'town' then nullif(p->>'town','') else town end,
    owner_name = case when p ? 'owner_name' then nullif(p->>'owner_name','') else owner_name end,
    phone      = case when p ? 'phone' then nullif(p->>'phone','') else phone end,
    email      = case when p ? 'email' then nullif(p->>'email','') else email end,
    website    = case when p ? 'website' then nullif(p->>'website','') else website end,
    gbp_url    = case when p ? 'gbp_url' then nullif(p->>'gbp_url','') else gbp_url end,
    notes      = case when p ? 'notes' then nullif(p->>'notes','') else notes end,
    status     = coalesce(nullif(p->>'status',''), status),
    business_id= case when p ? 'business_id' then nullif(p->>'business_id','')::uuid else business_id end,
    updated_at = now()
  where id = p_id;
  return found;
end $$;

create or replace function public.hq_project_item_set(p_id uuid, p_status text default null, p_finding text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update public.hq_project_items set
    status     = coalesce(p_status, status),
    finding    = case when p_finding is null then finding else nullif(trim(p_finding),'') end,
    updated_at = now()
  where id = p_id;
  update public.hq_projects set updated_at = now() where id = (select project_id from public.hq_project_items where id = p_id);
  return found;
end $$;

create or replace function public.hq_project_item_add(p_project uuid, p_grp text, p_label text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into public.hq_project_items (project_id, grp, label, ord)
    values (p_project, coalesce(nullif(p_grp,''),'Extra'), trim(p_label),
            coalesce((select max(ord) from public.hq_project_items where project_id = p_project), 100) + 1)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_project_item_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  delete from public.hq_project_items where id = p_id;
  return found;
end $$;

create or replace function public.hq_project_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  delete from public.hq_projects where id = p_id;
  return found;
end $$;

-- ---------- the client's read-only audit page (anon, by share token) ----------
-- Returns only what the client should see: name, town, status, and each step with its
-- status + finding. Never phone/email/notes/business_id.
create or replace function public.audit_public(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name, 'trade', p.trade, 'town', p.town, 'website', p.website, 'status', p.status,
    'updated_at', p.updated_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('grp', i.grp, 'label', i.label, 'how', i.how, 'status', i.status, 'finding', i.finding) order by i.ord), '[]')
              from public.hq_project_items i where i.project_id = p.id))
  from public.hq_projects p
  where p.share_token = p_token and length(p_token) >= 16
$$;

grant execute on function public.hq_playbook() to authenticated;
grant execute on function public.hq_projects() to authenticated;
grant execute on function public.hq_project(uuid) to authenticated;
grant execute on function public.hq_project_create(jsonb) to authenticated;
grant execute on function public.hq_project_save(uuid, jsonb) to authenticated;
grant execute on function public.hq_project_item_set(uuid, text, text) to authenticated;
grant execute on function public.hq_project_item_add(uuid, text, text) to authenticated;
grant execute on function public.hq_project_item_delete(uuid) to authenticated;
grant execute on function public.hq_project_delete(uuid) to authenticated;
grant execute on function public.audit_public(text) to anon, authenticated;

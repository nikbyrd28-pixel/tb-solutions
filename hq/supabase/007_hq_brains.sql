-- Agent brains, per-client agents, the learning loop, and visuals.
--
-- Every agent now has an editable brain in `agent_brains`: one row for TB Solutions
-- (business_id null) and one per shop that has marketing switched on. The scheduled tasks
-- read the brain at the top of every run, so an edit in HQ is live on the next run — same
-- model as the receptionist. `learned` is the part the weekly Coach rewrites from what got
-- posted, skipped and edited; `instructions` is Nick's and only Nick changes it.
--
-- Run after 006_hq_agents.sql. Idempotent.

-- ---------- brains ----------
create table if not exists public.agent_brains (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('prospector','seo','gbp','meta','content','review','visuals','coach')),
  business_id uuid references public.rx_businesses(id) on delete cascade,   -- null = TB Solutions
  instructions text not null default '',   -- Nick's standing orders for this agent
  learned text not null default '',        -- what the Coach has learned; agents read it, Coach rewrites it
  settings jsonb not null default '{}',    -- e.g. {"video": false, "posts_per_week": 3}
  updated_at timestamptz not null default now(),
  updated_by text                          -- 'nick' | 'coach' | 'owner'
);
create unique index if not exists agent_brains_key on public.agent_brains(agent, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.agent_brains enable row level security;

-- ---------- posts: media + learning signals ----------
alter table public.agent_posts add column if not exists media_url text;          -- thumbnail made by Visuals
alter table public.agent_posts add column if not exists video_url text;          -- clip made by Visuals (scripts only)
alter table public.agent_posts add column if not exists original_body text;      -- set on first edit so Coach can diff
alter table public.agent_posts add column if not exists edited boolean not null default false;
alter table public.agent_posts drop constraint if exists agent_posts_agent_check;
alter table public.agent_posts add constraint agent_posts_agent_check check (agent in ('gbp','meta','content'));

-- the shop-level switch for the paid add-on
alter table public.rx_businesses add column if not exists marketing boolean not null default false;

-- ---------- a plain log of what each agent did ----------
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  business_id uuid references public.rx_businesses(id) on delete cascade,
  note text not null,                      -- one line, in plain words, for the owner to read
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_biz_idx on public.agent_runs(business_id, created_at desc);
alter table public.agent_runs enable row level security;

-- ---------- HQ ----------
create or replace function public.hq_agent_brains() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'agent',a.agent,'business_id',a.business_id,'business',b.name,
      'instructions',a.instructions,'learned',a.learned,'settings',a.settings,'updated_at',a.updated_at,'updated_by',a.updated_by)
      order by a.business_id nulls first, a.agent), '[]')
    from agent_brains a left join rx_businesses b on b.id = a.business_id
  ) else null end
$$;

create or replace function public.hq_agent_brain_save(p_agent text, p_business uuid, p_instructions text, p_settings jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into agent_brains (agent, business_id, instructions, settings, updated_by)
    values (p_agent, p_business, coalesce(p_instructions,''), coalesce(p_settings,'{}'), 'nick')
  on conflict (agent, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update
    set instructions = excluded.instructions,
        settings = case when p_settings is null then agent_brains.settings else p_settings end,
        updated_at = now(), updated_by = 'nick'
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_agent_runs(p_days int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object('agent',r.agent,'business',b.name,'note',r.note,'created_at',r.created_at) order by r.created_at desc), '[]')
    from agent_runs r left join rx_businesses b on b.id = r.business_id
    where r.created_at > now() - make_interval(days => p_days)
  ) else null end
$$;

-- edits keep the original so the Coach can see what Nick changed
create or replace function public.hq_agent_post_edit(p_id uuid, p_body text, p_caption text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set original_body = coalesce(original_body, body), edited = true, body = p_body, caption = p_caption where id = p_id;
end $$;

-- posts now carry media + business for the inbox
create or replace function public.hq_agent_posts(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'agent',p.agent,'channel',p.channel,'business',b.name,'business_id',p.business_id,'title',p.title,'body',p.body,
      'caption',p.caption,'cta_url',p.cta_url,'media_note',p.media_note,'media_url',p.media_url,'video_url',p.video_url,'status',p.status,
      'posted_at',p.posted_at,'run_note',p.run_note,'edited',p.edited,'created_at',p.created_at)
      order by (p.status='draft') desc, p.created_at desc), '[]')
    from agent_posts p left join rx_businesses b on b.id = p.business_id
    where p.created_at > now() - make_interval(days => p_days) or p.status = 'draft'
  ) else null end
$$;

-- marketing switch lives in the brain editor save
create or replace function public.hq_rx_business_marketing(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update rx_businesses set marketing = p_on, updated_at = now() where id = p_id;
  if p_on then
    insert into agent_brains (agent, business_id, updated_by) select a, p_id, 'nick' from unnest(array['gbp','meta','review','visuals']) a
    on conflict do nothing;
  end if;
end $$;

grant execute on function public.hq_agent_brains(), public.hq_agent_brain_save(text,uuid,text,jsonb), public.hq_agent_runs(int), public.hq_rx_business_marketing(uuid,boolean) to authenticated;
revoke execute on function public.hq_agent_brains(), public.hq_agent_brain_save(text,uuid,text,jsonb), public.hq_agent_runs(int), public.hq_rx_business_marketing(uuid,boolean) from anon;

-- ---------- the owner app: what the shop sees ----------
create or replace function public.rx_owner_marketing(p_days int default 60) returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  return jsonb_build_object(
    'on', (select marketing from rx_businesses where id = v),
    'review_url', (select review_url from rx_businesses where id = v),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'channel',p.channel,'title',p.title,'body',p.body,'caption',p.caption,'media_note',p.media_note,'media_url',p.media_url,'video_url',p.video_url,'status',p.status,'posted_at',p.posted_at,'created_at',p.created_at) order by (p.status='draft') desc, p.created_at desc), '[]')
               from agent_posts p where p.business_id = v and (p.created_at > now() - make_interval(days => p_days) or p.status='draft')),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object('customer',j.customer_name,'status',a.status,'reason',a.reason,'created_at',a.created_at) order by a.created_at desc), '[]')
                from rx_review_asks a join rx_jobs j on j.id = a.job_id where a.business_id = v and a.created_at > now() - make_interval(days => p_days)),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('agent',agent,'note',note,'created_at',created_at) order by created_at desc), '[]')
             from (select * from agent_runs where business_id = v order by created_at desc limit 30) r),
    'brains', (select coalesce(jsonb_agg(jsonb_build_object('agent',agent,'instructions',instructions,'learned',learned)), '[]') from agent_brains where business_id = v));
end $$;

create or replace function public.rx_owner_post_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  if p_status not in ('draft','posted','skipped') then raise exception 'bad status'; end if;
  update agent_posts set status = p_status, posted_at = case when p_status='posted' then now() else null end where id = p_id and business_id = v;
end $$;

create or replace function public.rx_owner_post_edit(p_id uuid, p_body text, p_caption text) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  update agent_posts set original_body = coalesce(original_body, body), edited = true, body = p_body, caption = p_caption where id = p_id and business_id = v;
end $$;

-- the owner can tell their own agents things ("we don't do commercial", "mention the 24/7 line")
create or replace function public.rx_owner_brain_save(p_agent text, p_instructions text) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  if p_agent not in ('gbp','meta','review','visuals') then raise exception 'bad agent'; end if;
  insert into agent_brains (agent, business_id, instructions, updated_by) values (p_agent, v, coalesce(p_instructions,''), 'owner')
  on conflict (agent, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set instructions = excluded.instructions, updated_at = now(), updated_by = 'owner';
end $$;

create or replace function public.rx_owner_review_url(p_url text) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  update rx_businesses set review_url = nullif(trim(p_url),''), updated_at = now() where id = v;
end $$;

grant execute on function public.rx_owner_marketing(int), public.rx_owner_post_status(uuid,text), public.rx_owner_post_edit(uuid,text,text), public.rx_owner_brain_save(text,text), public.rx_owner_review_url(text) to authenticated;
revoke execute on function public.rx_owner_marketing(int), public.rx_owner_post_status(uuid,text), public.rx_owner_post_edit(uuid,text,text), public.rx_owner_brain_save(text,text), public.rx_owner_review_url(text) from anon;

-- ---------- seed TB's own brains (instructions empty = AGENTS.md defaults apply) ----------
insert into agent_brains (agent, business_id, updated_by) select a, null, 'nick' from unnest(array['prospector','seo','gbp','meta','content','review','visuals','coach']) a
on conflict do nothing;
update agent_brains set settings = '{"video": false}' where agent = 'visuals' and business_id is null and settings = '{}';

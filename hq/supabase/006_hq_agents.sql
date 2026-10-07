-- The marketing fleet. Three writers (GBP, Meta, Content) and one sender (Review).
--
-- The writers are scheduled Claude tasks. GBP cannot post to Google for Nick (no API token),
-- so it writes finished posts into `agent_posts`. (Meta auto-publishes since 011_hq_meta_publish.sql.)
-- Posts land in `agent_posts`,
-- and HQ shows them with a Copy button. Nick pastes, taps "Posted", done. The agent's
-- status in HQ is read from these rows, never from what the agent says about itself.
--
-- The Review agent is an edge function (rx-review) on pg_cron: when a receptionist job is
-- marked done and the customer agreed to texts on the call, it texts them the shop's
-- Google review link once, and logs exactly what it did (or why it skipped) in rx_review_asks.
--
-- Run after 005_hq_recon.sql. Idempotent.

-- ---------- posts written by the agents ----------
create table if not exists public.agent_posts (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('gbp','meta','content')),
  channel text not null check (channel in ('gbp','facebook','instagram','script')),
  business_id uuid references public.rx_businesses(id) on delete set null, -- null = TB Solutions itself
  title text,
  body text not null,
  caption text,                 -- IG/FB caption or the on-screen text for a script
  cta_url text,
  media_note text,              -- what photo/video to attach, in plain words
  status text not null default 'draft' check (status in ('draft','posted','skipped')),
  posted_at timestamptz,
  run_note text,                -- one line from the agent about why this post, this week
  created_at timestamptz not null default now()
);
create index if not exists agent_posts_status_idx on public.agent_posts(status, created_at desc);
alter table public.agent_posts enable row level security;   -- no policies: RPCs + service role only

create or replace function public.hq_agent_posts(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'agent',p.agent,'channel',p.channel,'business',b.name,'title',p.title,'body',p.body,
      'caption',p.caption,'cta_url',p.cta_url,'media_note',p.media_note,'status',p.status,
      'posted_at',p.posted_at,'run_note',p.run_note,'created_at',p.created_at)
      order by (p.status='draft') desc, p.created_at desc), '[]')
    from agent_posts p left join rx_businesses b on b.id = p.business_id
    where p.created_at > now() - make_interval(days => p_days) or p.status = 'draft'
  ) else null end
$$;

create or replace function public.hq_agent_post_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set status = p_status,
    posted_at = case when p_status = 'posted' then now() else null end
  where id = p_id;
end $$;

create or replace function public.hq_agent_post_edit(p_id uuid, p_body text, p_caption text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set body = p_body, caption = p_caption where id = p_id;
end $$;

-- ---------- review asks (sent by rx-review) ----------
alter table public.rx_businesses add column if not exists review_url text;

create table if not exists public.rx_review_asks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.rx_jobs(id) on delete cascade,
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  phone text,
  status text not null check (status in ('sent','skipped','failed')),
  reason text,                  -- for skipped/failed: 'no_consent' | 'no_review_url' | 'no_phone' | twilio error
  created_at timestamptz not null default now()
);
create index if not exists rx_review_asks_biz_idx on public.rx_review_asks(business_id, created_at desc);
alter table public.rx_review_asks enable row level security;

create or replace function public.hq_review_asks(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'asks', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'business',b.name,'customer',j.customer_name,'phone',a.phone,
                'status',a.status,'reason',a.reason,'created_at',a.created_at) order by a.created_at desc), '[]')
             from rx_review_asks a join rx_businesses b on b.id=a.business_id join rx_jobs j on j.id=a.job_id
             where a.created_at > now() - make_interval(days => p_days)),
    'no_url', (select coalesce(jsonb_agg(b.name), '[]') from rx_businesses b where b.active and b.review_url is null),
    'pending', (select count(*) from rx_jobs j where j.status='done' and not exists (select 1 from rx_review_asks a where a.job_id=j.id))
  ) else null end
$$;

-- let the brain editor save the review link
create or replace function public.hq_rx_business_save(p_id uuid, p jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update rx_businesses set
    name = coalesce(p->>'name', name),
    trade = coalesce(p->>'trade', trade),
    owner_name = coalesce(p->>'owner_name', owner_name),
    owner_phone = coalesce(p->>'owner_phone', owner_phone),
    agent_name = coalesce(p->>'agent_name', agent_name),
    agent_number = case when p ? 'agent_number' then nullif(p->>'agent_number','') else agent_number end,
    timezone = coalesce(p->>'timezone', timezone),
    service_zips = case when p ? 'service_zips' then array(select jsonb_array_elements_text(p->'service_zips')) else service_zips end,
    service_area_note = case when p ? 'service_area_note' then nullif(p->>'service_area_note','') else service_area_note end,
    service_fee_cents = case when p ? 'service_fee_cents' then (p->>'service_fee_cents')::int else service_fee_cents end,
    after_hours_fee_cents = case when p ? 'after_hours_fee_cents' then (p->>'after_hours_fee_cents')::int else after_hours_fee_cents end,
    free_estimates = coalesce((p->>'free_estimates')::boolean, free_estimates),
    hours = coalesce(p->'hours', hours),
    windows = coalesce(p->'windows', windows),
    jobs_per_window = coalesce((p->>'jobs_per_window')::int, jobs_per_window),
    emergency_policy = coalesce(p->>'emergency_policy', emergency_policy),
    transfer_number = case when p ? 'transfer_number' then nullif(p->>'transfer_number','') else transfer_number end,
    knowledge = case when p ? 'knowledge' then p->>'knowledge' else knowledge end,
    review_url = case when p ? 'review_url' then nullif(p->>'review_url','') else review_url end,
    active = coalesce((p->>'active')::boolean, active),
    updated_at = now()
  where id = p_id;
end $$;

grant execute on function public.hq_agent_posts(int), public.hq_agent_post_status(uuid,text), public.hq_agent_post_edit(uuid,text,text), public.hq_review_asks(int) to authenticated;
revoke execute on function public.hq_agent_posts(int), public.hq_agent_post_status(uuid,text), public.hq_agent_post_edit(uuid,text,text), public.hq_review_asks(int) from anon;

-- ---------- run rx-review every hour ----------
-- The function checks its own secret (RX_SYNC_SECRET, same one rx-sync uses).
select cron.unschedule(jobid) from cron.job where jobname = 'rx-review-hourly';
select cron.schedule('rx-review-hourly', '15 * * * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{}'::jsonb)
$cron$);

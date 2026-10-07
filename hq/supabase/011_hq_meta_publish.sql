-- Meta auto-publish. Facebook + Instagram drafts in `agent_posts` go out on their own.
--
-- How it works: the Meta writer still drops drafts at 7:15am and Visuals still puts a picture on
-- them at 7:40am. From then on a draft is on a timer (`META_AUTOPOST_DELAY_MIN`, default 120 min
-- after it was written). Nick can Skip or Edit it in HQ inside that window; if he does nothing,
-- the `meta-publish` edge function (pg_cron, every 15 min) posts it to the Page / IG account and
-- marks it `posted` with the real post id. "Post now" in HQ skips the wait.
--
-- Needs, in rx_config (set from HQ → Agents → Meta card → Connect):
--   META_PAGE_ID        the Facebook Page id
--   META_PAGE_TOKEN     a long-lived Page access token (pages_manage_posts, instagram_content_publish)
--   META_IG_USER_ID     the Instagram professional account id linked to that Page (optional → IG skipped)
--   META_AUTOPOST       'on' | 'off'  (default off until the token is in)
--   META_AUTOPOST_DELAY_MIN  minutes a draft sits in HQ before it goes out (default 120)
--
-- Run after 010. Idempotent.

alter table public.agent_posts add column if not exists publish_after timestamptz;  -- set by "Post now" (= now) or left null → timer
alter table public.agent_posts add column if not exists publish_error text;         -- last Meta error, cleared on success
alter table public.agent_posts add column if not exists external_id text;           -- Meta post id
alter table public.agent_posts add column if not exists external_url text;          -- permalink
alter table public.agent_posts add column if not exists publish_attempts int not null default 0;

-- what the publisher picks up: TB Solutions' own FB/IG drafts (shops have no token), due, under the retry cap
create or replace function public.meta_due_posts() returns setof public.agent_posts
language sql stable security definer set search_path = public as $$
  with c as (
    select coalesce((select value from rx_config where key='META_AUTOPOST'),'off') = 'on' as auto,
           coalesce(nullif((select value from rx_config where key='META_AUTOPOST_DELAY_MIN'),'')::int, 120) as delay_min
  )
  select p.* from agent_posts p, c
  where p.status = 'draft' and p.channel in ('facebook','instagram') and p.business_id is null
    and p.publish_attempts < 3
    and ( p.publish_after <= now()
          or (p.publish_after is null and c.auto and p.created_at <= now() - make_interval(mins => c.delay_min)) )
    -- Instagram cannot post without an image; give Visuals until the next pass
    and (p.channel = 'facebook' or p.media_url is not null)
  order by p.created_at asc limit 5
$$;
revoke all on function public.meta_due_posts() from public, anon, authenticated;
grant execute on function public.meta_due_posts() to service_role;   -- the edge function is the only caller

-- HQ: "Post now" — stamps the draft and pokes the function so it goes out this minute
create or replace function public.hq_agent_post_publish_now(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set publish_after = now(), publish_error = null, publish_attempts = 0
  where id = p_id and status = 'draft' and channel in ('facebook','instagram');
  select value into v_secret from rx_config where key = 'RX_SYNC_SECRET';
  perform net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/meta-publish',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce(v_secret,'')),
    body := jsonb_build_object('id', p_id));
end $$;

-- HQ: Meta connection settings. The token is write-only — HQ only ever learns whether one is set.
create or replace function public.hq_meta_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'page_id',   (select value from rx_config where key='META_PAGE_ID'),
    'ig_user_id',(select value from rx_config where key='META_IG_USER_ID'),
    'has_token', exists(select 1 from rx_config where key='META_PAGE_TOKEN' and value <> ''),
    'autopost',  coalesce((select value from rx_config where key='META_AUTOPOST'),'off') = 'on',
    'delay_min', coalesce(nullif((select value from rx_config where key='META_AUTOPOST_DELAY_MIN'),'')::int, 120)
  ) else null end
$$;

create or replace function public.hq_meta_config_save(p_page_id text, p_ig_user_id text, p_token text, p_autopost boolean, p_delay_min int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into rx_config(key,value) values ('META_PAGE_ID', coalesce(trim(p_page_id),'')) on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into rx_config(key,value) values ('META_IG_USER_ID', coalesce(trim(p_ig_user_id),'')) on conflict (key) do update set value = excluded.value, updated_at = now();
  if p_token is not null and trim(p_token) <> '' then   -- blank = keep the one on file
    insert into rx_config(key,value) values ('META_PAGE_TOKEN', trim(p_token)) on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  insert into rx_config(key,value) values ('META_AUTOPOST', case when p_autopost then 'on' else 'off' end) on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into rx_config(key,value) values ('META_AUTOPOST_DELAY_MIN', greatest(0, coalesce(p_delay_min,120))::text) on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- the inbox now carries publish state
create or replace function public.hq_agent_posts(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'agent',p.agent,'channel',p.channel,'business',b.name,'business_id',p.business_id,'title',p.title,'body',p.body,
      'caption',p.caption,'cta_url',p.cta_url,'media_note',p.media_note,'media_url',p.media_url,'video_url',p.video_url,'status',p.status,
      'posted_at',p.posted_at,'run_note',p.run_note,'edited',p.edited,'created_at',p.created_at,
      'publish_after',p.publish_after,'publish_error',p.publish_error,'external_url',p.external_url,'publish_attempts',p.publish_attempts)
      order by (p.status='draft') desc, p.created_at desc), '[]')
    from agent_posts p left join rx_businesses b on b.id = p.business_id
    where p.created_at > now() - make_interval(days => p_days) or p.status = 'draft'
  ) else null end
$$;

grant execute on function public.hq_agent_post_publish_now(uuid), public.hq_meta_config(), public.hq_meta_config_save(text,text,text,boolean,int) to authenticated;
revoke execute on function public.hq_agent_post_publish_now(uuid), public.hq_meta_config(), public.hq_meta_config_save(text,text,text,boolean,int) from anon;

-- every 15 minutes: push whatever is due
select cron.unschedule('meta-publish-15min') where exists (select 1 from cron.job where jobname = 'meta-publish-15min');
select cron.schedule('meta-publish-15min', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/meta-publish',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{}'::jsonb)
$cron$);

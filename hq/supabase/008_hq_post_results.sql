-- What each post actually did. Keyed on the utm_campaign tag p-<first 8 of post id> that every
-- writer puts on its CTA link (see AGENTS.md → Track every link). Phone CTAs are measured as
-- calls to that business's line (TB = the demo line) in the 48 hours after it was marked posted.
-- Run after 007_hq_brains.sql. Idempotent.
create or replace function public.post_results_calc(p_days int default 60) returns table(post_id uuid, visits bigint, leads bigint, calls bigint)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*) from visitors v where v.utm_campaign = 'p-'||left(p.id::text,8)) as visits,
    (select count(*) from lsa_leads l where l.utm::text like '%p-'||left(p.id::text,8)||'%')
      + (select count(*) from intakes i where i.ref like '%p-'||left(p.id::text,8)||'%') as leads,
    (case when p.posted_at is null then 0 else (select count(*) from rx_calls c join rx_businesses b on b.id=c.business_id where (p.business_id is null and b.slug='demo' or p.business_id = b.id) and c.started_at between p.posted_at and p.posted_at + interval '48 hours') end) as calls
  from agent_posts p where p.created_at > now() - make_interval(days => p_days)
$$;
create or replace function public.hq_post_results(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (select coalesce(jsonb_object_agg(post_id, jsonb_build_object('visits',visits,'leads',leads,'calls',calls)), '{}') from post_results_calc(p_days)) else null end
$$;
create or replace function public.rx_owner_post_results(p_days int default 60) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  return (select coalesce(jsonb_object_agg(r.post_id, jsonb_build_object('visits',r.visits,'leads',r.leads,'calls',r.calls)), '{}')
          from post_results_calc(p_days) r join agent_posts p on p.id = r.post_id where p.business_id = v);
end $$;
revoke execute on function public.post_results_calc(int) from anon, authenticated;
grant execute on function public.hq_post_results(int), public.rx_owner_post_results(int) to authenticated;
revoke execute on function public.hq_post_results(int), public.rx_owner_post_results(int) from anon;

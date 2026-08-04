-- ============================================================================
-- Loop — reviews, keyed by shop slug
-- ----------------------------------------------------------------------------
-- THE PROBLEM (migrations reviews_keyed_by_client_slug +
-- owner_dashboard_reviews_by_client)
--
-- public.reviews had no client column, so everything keyed off the free-text
-- business NAME — and the writers and readers disagreed about what belonged
-- there. Three different keys were in live use at once:
--
--   submit_survey wrote the SLUG           -> 'demo'
--   /review/ writes whatever ?b= carries   -> 'Demo Barbershop'
--   both readers looked up the BIZ_NAME    -> 'Maple Street Barbers'
--
-- So every survey review an owner collected was invisible on their own
-- dashboard AND on their public review wall, and renaming a business orphaned
-- whatever was left. The demo shop had exactly this: one survey review filed
-- under 'demo', one smart-review under a stale display name, and a dashboard
-- reporting zero.
--
-- The slug is the only identifier that never changes, so reviews now carry a
-- client column and both readers match on it. The old name match is kept as a
-- fallback for rows with no client, so nothing already published disappears.
--
-- STILL ORPHANED, and correctly so: a review whose business name matches no
-- shop's slug or current display name cannot be attributed and keeps
-- client=null. There is one live row like this ('Demo Barbershop', from a stale
-- ?b= link). It was invisible before this change too — it is not a regression,
-- and the HQ review manager can see and fix it by hand.
--
-- ANYONE ADDING A REVIEW WRITER: set client to the slug. business is a display
-- name only and must never be relied on as a key.
-- ============================================================================

alter table public.reviews add column if not exists client text;
create index if not exists reviews_client_idx on public.reviews(client) where client is not null;

-- Backfill: a review belongs to the shop whose slug or current display name it
-- names. Anything matching neither is left null and found by the name fallback.
update public.reviews r
   set client = s.client
  from public.reward_settings s
 where r.client is null
   and ( lower(btrim(r.business)) = lower(s.client)
      or lower(btrim(r.business)) = lower(coalesce(s.biz_name,'')) )
   and coalesce(btrim(r.business),'') <> '';

-- ----------------------------------------------------------------------------
-- submit_survey — pays survey_points and files the review.
-- Files against the slug, and puts the shop's display name in business so the
-- HQ review list and any older name-matching reader stay meaningful.
--
-- Also closes the read-then-write gap on the once-a-week guard: it read
-- last_survey_at and then updated it in a separate statement, so two concurrent
-- submissions both passed and both paid out.
-- ----------------------------------------------------------------------------
create or replace function public.submit_survey(p_code text, p_rating integer, p_text text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; v_id public.reward_members.id%type;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  v_id := m.id;
  if m.last_survey_at is not null and m.last_survey_at > now() - interval '7 days' then
    return jsonb_build_object('error','You already earned survey points this week — come back soon!');
  end if;
  select * into s from public.reward_settings where client = m.client;
  -- atomic: the racing second submission updates no rows and is refused
  update public.reward_members
     set points = points + s.survey_points, lifetime = lifetime + s.survey_points, last_survey_at = now()
   where id = v_id
     and (last_survey_at is null or last_survey_at <= now() - interval '7 days')
  returning * into m;
  if m.id is null then
    return jsonb_build_object('error','You already earned survey points this week — come back soon!');
  end if;
  insert into public.reviews (client, name, business, rating, text, source, approved)
    values (m.client, m.name, coalesce(nullif(btrim(coalesce(s.biz_name,'')),''), m.client),
            greatest(1, least(5, coalesce(p_rating,5))), left(coalesce(p_text,''), 1000), 'rewards survey', false);
  return (to_jsonb(m) - 'phone') || jsonb_build_object('reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', s.spin_cost,
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p));
end $$;

-- ----------------------------------------------------------------------------
-- The public review wall (/rewards/wall/). Matches on the slug, keeping the old
-- name match for legacy rows with no client.
-- ----------------------------------------------------------------------------
create or replace function public.get_reviews_public(p_client text)
returns json language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; bname text; v json;
begin
  select * into s from public.reward_settings
    where client = regexp_replace(lower(coalesce(p_client,'')), '[^a-z0-9]', '', 'g') limit 1;
  bname := coalesce(nullif(s.biz_name,''), initcap(coalesce(s.client, p_client)));
  select json_build_object(
    'biz_name', bname,
    'google_review_url', s.google_review_url,
    'count', (select count(*) from reviews where approved
               and (client = s.client or (client is null and lower(business)=lower(bname)))),
    'avg', (select coalesce(round(avg(rating)::numeric,1),0) from reviews where approved
               and (client = s.client or (client is null and lower(business)=lower(bname)))),
    'reviews', (select coalesce(json_agg(to_jsonb(r)),'[]'::json) from (
        select name, rating, text, created_at
        from reviews
        where approved and coalesce(text,'')<>''
          and (client = s.client or (client is null and lower(business)=lower(bname)))
        order by created_at desc limit 60
    ) r)
  ) into v;
  return v;
end $$;

grant execute on function public.submit_survey(text,integer,text) to anon, authenticated;
grant execute on function public.get_reviews_public(text)         to anon, authenticated;

-- loyalty_owner_dashboard (hq/loyalty.sql) matches reviews the same way.
-- The third writer is /review/ (the smart-review page), which posts straight to
-- the table through PostgREST and now sends client alongside business. RLS on
-- reviews allows an anon insert with check (true), so no policy change was
-- needed for the new column.

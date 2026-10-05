-- Recon: the audit that turns a cold call into a specific one.
--
-- Today an opener is "listed closed weekends". After recon it is "you're paying Google for
-- leads and your profile has no hours — those clicks land on a closed sign." Same prospect,
-- completely different call.
--
-- Everything stored here is PUBLIC information: their own website, their Google Business
-- Profile, the Google Guaranteed badge in search results, and the Meta Ad Library, which
-- Meta publishes deliberately. Nothing is scraped from behind a login and nobody is contacted.
--
-- Run after 004_hq_billing.sql. Idempotent.

alter table public.rx_prospects add column if not exists audit jsonb;
alter table public.rx_prospects add column if not exists audited_at timestamptz;
create index if not exists rx_prospects_audit_idx on public.rx_prospects(audited_at nulls first)
  where status = 'new';

-- Who to audit next: uncalled prospects, best score first, never audited or gone stale.
-- Capped so a run cannot blow up; recon costs real time per prospect.
create or replace function public.hq_audit_queue(p_limit int default 10, p_stale_days int default 60)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'trade', p.trade, 'city', p.city, 'zip', p.zip,
      'phone', p.phone, 'website', p.website, 'rating', p.rating, 'reviews', p.reviews,
      'hours_note', p.hours_note, 'google_place_id', p.google_place_id, 'why', p.why,
      'audited_at', p.audited_at) order by p.score desc, p.created_at), '[]')
    from (select * from rx_prospects
           where business_id is null and status = 'new'
             and (audited_at is null or audited_at < now() - make_interval(days => p_stale_days))
           order by score desc, created_at limit p_limit) p
  ) else null end
$$;

-- Write one prospect's audit. The opener is the point of the whole exercise: one sentence
-- Nick can say out loud that proves he actually looked at their business.
create or replace function public.hq_prospect_audit(p_id uuid, p_audit jsonb, p_opener text default null,
  p_score_delta int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.rx_prospects;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update public.rx_prospects set
    audit = p_audit,
    audited_at = now(),
    why = coalesce(nullif(trim(coalesce(p_opener,'')), ''), why),
    score = greatest(0, least(100, score + coalesce(p_score_delta, 0)))
  where id = p_id returning * into r;
  if not found then raise exception 'no such prospect'; end if;
  return to_jsonb(r);
end $$;

grant execute on function public.hq_audit_queue(int, int) to authenticated;
grant execute on function public.hq_prospect_audit(uuid, jsonb, text, int) to authenticated;

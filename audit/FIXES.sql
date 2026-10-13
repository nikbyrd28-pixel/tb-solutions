-- TB Solutions / Supabase "Base" (qgbjiqdwzgkjkmqyjsmc)
-- Proposed fixes from the 2026-10-13 audit. NOT APPLIED. Review, then run in the SQL editor
-- (or save as a new supabase/migrations file). Each block is independent; run top to bottom.
--
-- Context: every public table has RLS ON, but anon + authenticated hold full table GRANTS
-- (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) on all of them. RLS with zero policies = closed, so
-- today the no-policy tables are not readable from the browser. The holes are the policies that
-- DO exist plus the SECURITY DEFINER functions. Nothing below changes edge functions (they use
-- the service role and bypass RLS).

-- ============================================================================
-- 1. HIGH. Drop blanket table grants on live product tables. Browser code reaches these only
--    through RPCs (hq_*, rx_owner_*, audit_public) or the service role, so direct grants are
--    never needed. Keeps anon/authenticated from using any future accidental permissive policy
--    and removes TRUNCATE/REFERENCES/TRIGGER, which RLS never protects.
-- ============================================================================
revoke all on table
  public.rx_businesses, public.rx_business_users, public.rx_services, public.rx_jobs,
  public.rx_calls, public.rx_messages, public.rx_config, public.rx_do_not_call,
  public.rx_integrations, public.rx_on_call, public.rx_owner_invites, public.rx_prospects,
  public.rx_review_asks, public.rx_sms_optins, public.rx_sync_log,
  public.hq_admins, public.hq_playbook, public.hq_projects, public.hq_project_items,
  public.lsa_leads, public.agent_posts, public.agent_runs, public.agent_brains,
  public.seo_keywords, public.seo_links
from anon, authenticated;

-- rx owner app reads its own rows directly (policies rx_*_owner_read / _owner_rw exist),
-- so give authenticated SELECT back on those four, and UPDATE where the policy allows it.
grant select on table public.rx_businesses, public.rx_business_users, public.rx_services,
  public.rx_calls, public.rx_jobs, public.rx_messages, public.hq_admins to authenticated;
grant update on table public.rx_jobs, public.rx_messages to authenticated;

-- intakes / pageviews / visitors: keep INSERT for the public (forms + track.js), keep admin SELECT.
revoke all on table public.intakes, public.pageviews, public.visitors from anon, authenticated;
grant insert on table public.intakes, public.pageviews, public.visitors to anon, authenticated;
grant select, update on table public.intakes to authenticated;
grant select on table public.pageviews, public.visitors to authenticated;

-- ============================================================================
-- 2. HIGH. Lock down the SECURITY DEFINER view loop_crm_board (advisor ERROR). It aggregates the
--    archived Loop CRM; nothing live reads it. Switch to invoker + drop public grants.
-- ============================================================================
alter view public.loop_crm_board set (security_invoker = true);
revoke all on public.loop_crm_board from anon, authenticated;

-- ============================================================================
-- 3. HIGH. Remove anon EXECUTE on SECURITY DEFINER functions that are admin/owner-only.
--    hq_* are guarded by is_hq_admin(); rx_owner_* by auth.uid(); both return nothing for anon,
--    but anon should not be able to call them at all. audit_public(token) stays public on purpose.
--    sms_inbound stays (Twilio webhook path). Review the archived ones (uni_*, loop_*, crm_*, bj_*,
--    vp_*, amb_*) separately; they are listed by the advisor but belong to parked/archived products.
-- ============================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proname like 'hq\_%' or p.proname like 'rx\_owner\_%'
           or p.proname in ('rx_weekly_report','send_owner_daily','send_owner_digest',
                            'hq_finder_import','is_hq_admin'))
  loop
    execute format('revoke execute on function %s from anon, public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- rx_weekly_report exposes owner phone numbers for every business; only n8n (service role) needs it.
revoke execute on function public.rx_weekly_report(integer) from anon, authenticated, public;

-- ============================================================================
-- 4. MEDIUM. Pin search_path on the 10 live-product helper functions the advisor flagged
--    (function_search_path_mutable). The other 18 flagged functions are archived Loop/arcade/uni.
-- ============================================================================
alter function public._smsenc(text)                      set search_path = public, pg_temp;
alter function public._telfmt(text)                      set search_path = public, pg_temp;
alter function public.hq_next_business_morning(integer)  set search_path = public, pg_temp;
alter function public.hq_prospect_slots(integer)         set search_path = public, pg_temp;
alter function public.hq_quality_floor()                 set search_path = public, pg_temp;
alter function public.rx_is_blocked(text, text)          set search_path = public, pg_temp;
alter function public.rx_touch()                         set search_path = public, pg_temp;
alter function public.safe_int(text)                     set search_path = public, pg_temp;
alter function public.site_sanitize(jsonb)               set search_path = public, pg_temp;
alter function public.sms_num(text)                      set search_path = public, pg_temp;
alter function public.hb_analytics_summary()             set search_path = public, pg_temp;

-- ============================================================================
-- 5. MEDIUM. Performance: duplicate index on rx_prospects, missing FK indexes on live tables.
-- ============================================================================
drop index if exists public.rx_prospects_status_idx;   -- identical to rx_prospects_score_idx
drop index if exists public.loop_crm_slug_uq;          -- identical to loop_crm_slug_key (archived table)

create index if not exists rx_jobs_call_id_idx       on public.rx_jobs (call_id);
create index if not exists rx_jobs_service_id_idx    on public.rx_jobs (service_id);
create index if not exists rx_messages_business_idx  on public.rx_messages (business_id);
create index if not exists rx_messages_call_id_idx   on public.rx_messages (call_id);
create index if not exists rx_prospects_business_idx on public.rx_prospects (business_id);
create index if not exists agent_posts_business_idx  on public.agent_posts (business_id);
create index if not exists agent_brains_business_idx on public.agent_brains (business_id);
create index if not exists hq_projects_business_idx  on public.hq_projects (business_id);
create index if not exists visitors_client_id_idx    on public.visitors (client_id);

-- ============================================================================
-- 6. MEDIUM. auth_rls_initplan: policies call auth.uid()/auth.jwt() per row. Wrap in (select ...).
--    Shown for the live tables only; same pattern applies to the archived ones if ever needed.
-- ============================================================================
alter policy "hq_admins_self"        on public.hq_admins         using (user_id = (select auth.uid()));
alter policy "rx_bu_self"            on public.rx_business_users using (user_id = (select auth.uid()));
alter policy "rx_biz_owner_read"     on public.rx_businesses     using (id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())));
alter policy "rx_services_owner_read" on public.rx_services      using (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())));
alter policy "rx_calls_owner_read"   on public.rx_calls          using (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())));
alter policy "rx_jobs_owner_rw"      on public.rx_jobs
  using (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())))
  with check (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())));
alter policy "rx_messages_owner_rw"  on public.rx_messages
  using (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())))
  with check (business_id IN (select business_id from public.rx_business_users where user_id = (select auth.uid())));
alter policy "admin reads intakes"   on public.intakes   using (((select auth.jwt()) ->> 'email') = 'nikbyrd28@gmail.com');
alter policy "admin manages intakes" on public.intakes
  using (((select auth.jwt()) ->> 'email') = 'nikbyrd28@gmail.com')
  with check (((select auth.jwt()) ->> 'email') = 'nikbyrd28@gmail.com');
alter policy "admin reads views"     on public.pageviews using (((select auth.jwt()) ->> 'email') = 'nikbyrd28@gmail.com');

-- ============================================================================
-- 7. LOW. pg_net lives in public (extension_in_public). Moving it requires re-pointing the
--    pg_cron jobs that call net.http_post; do this in a quiet window.
-- ============================================================================
-- create schema if not exists extensions;
-- alter extension pg_net set schema extensions;

-- ============================================================================
-- 8. Dashboard-only items (no SQL):
--   * Auth > Providers > Email: turn ON "Leaked password protection" (advisor WARN).
--   * Auth > Settings: anonymous sign-ins are enabled. No tbsol.net page calls signInAnonymously;
--     turn it OFF unless Chalk/NB TV still needs it. That clears 85 auth_allow_anonymous_sign_ins WARNs.
--   * Edge Functions > Secrets: move VAPI_WEBHOOK_SECRET, TWILIO_API_KEY, TWILIO_API_SECRET,
--     RX_SYNC_SECRET out of the rx_config table into real secrets (ECOSYSTEM decommission #3).
-- ============================================================================

-- Rank Fix, automated: the rank-audit edge function runs the machine half of the 17-step playbook
-- and writes what it found onto the project's steps. This file is the database half.
--
--   * hq_project_items gets `evidence` (raw proof, HQ only), `auto` (was this line written by the
--     machine or by Nick), `checked_at`, and `regressed` (passed last month, fails now).
--   * hq_projects gets `place_id`, `audited_at`, `audit_summary`, `audit_error`.
--   * rank_audit_apply(project, results, summary)  <- service role only, called by the edge fn.
--     done     when the machine checked it and it passed
--     todo     when it failed, with the one-line finding the client reads
--     todo     when it needs a human, with a private "what to do" note (finding untouched)
--     Nick's own done/na is never overwritten by a pass; a fail on a step Nick marked done flips
--     it back to todo and flags `regressed` (that is the $97/mo: listings watched for drift).
--   * rank_audit_due()  <- which projects the monthly cron re-checks (active + done).
--   * hq_project_audit_run(project) <- HQ taps "Re-run audit": asks pg_net to call the function.
--   * audit_public(token) gains `checked_at` per item and `audited_at` on the project. Nothing else.
--   * pg_cron: 1st of the month, 11:40 UTC.
--
-- Run after 013_hq_work.sql. Idempotent.

-- ---------- columns ----------
alter table public.hq_project_items add column if not exists evidence   jsonb;
alter table public.hq_project_items add column if not exists auto       boolean not null default false;
alter table public.hq_project_items add column if not exists checked_at timestamptz;
alter table public.hq_project_items add column if not exists regressed  boolean not null default false;
alter table public.hq_project_items add column if not exists next_step  text;   -- private: what Nick does next

alter table public.hq_projects add column if not exists place_id      text;
alter table public.hq_projects add column if not exists audited_at    timestamptz;
alter table public.hq_projects add column if not exists audit_summary jsonb;
alter table public.hq_projects add column if not exists audit_error   text;

-- ---------- apply one audit run (service role only) ----------
-- p_results: [{key, check: pass|fail|manual|error, finding?, next_step?, evidence?}, ...]
create or replace function public.rank_audit_apply(p_project uuid, p_results jsonb, p_summary jsonb default null, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_key text; v_check text; v_finding text;
  cur public.hq_project_items;
  n_upd int := 0; n_reg int := 0;
begin
  if p_error is not null then
    update public.hq_projects set audit_error = left(p_error, 300), updated_at = now() where id = p_project;
    return jsonb_build_object('ok', false, 'error', left(p_error, 300));
  end if;
  if p_results is null or jsonb_typeof(p_results) <> 'array' then raise exception 'results must be an array'; end if;

  for r in select * from jsonb_array_elements(p_results) loop
    v_key := r->>'key'; v_check := r->>'check'; v_finding := nullif(trim(coalesce(r->>'finding','')),'');
    select * into cur from public.hq_project_items where project_id = p_project and key = v_key order by ord limit 1;
    if not found then continue; end if;

    if v_check = 'pass' then
      update public.hq_project_items set
        status     = case when status in ('done','na') then status else 'done' end,
        finding    = case when auto or finding is null then coalesce(v_finding, finding) else finding end,
        auto       = case when auto or finding is null then true else auto end,
        next_step  = null,
        evidence   = coalesce(r->'evidence', evidence),
        regressed  = false,
        checked_at = now(), updated_at = now()
      where id = cur.id;
      n_upd := n_upd + 1;

    elsif v_check = 'fail' then
      -- a fail on a step that was done (by Nick or by a past pass) is a regression
      if cur.status = 'done' then n_reg := n_reg + 1; end if;
      update public.hq_project_items set
        status     = case when status = 'na' then 'na' when status = 'doing' then 'doing' else 'todo' end,
        finding    = case when auto or finding is null then coalesce(v_finding, finding) else finding end,
        auto       = case when auto or finding is null then true else auto end,
        next_step  = nullif(trim(coalesce(r->>'next_step','')),''),
        evidence   = coalesce(r->'evidence', evidence),
        regressed  = (cur.status = 'done'),
        checked_at = now(), updated_at = now()
      where id = cur.id;
      n_upd := n_upd + 1;

    elsif v_check = 'manual' then
      -- stays where it is; the machine only leaves a hint, and a finding only if the box is empty
      update public.hq_project_items set
        finding    = case when finding is null and v_finding is not null then v_finding else finding end,
        auto       = case when finding is null and v_finding is not null then true else auto end,
        next_step  = coalesce(nullif(trim(coalesce(r->>'next_step','')),''), next_step),
        evidence   = coalesce(r->'evidence', evidence),
        checked_at = now()
      where id = cur.id;
    end if;
  end loop;

  update public.hq_projects set
    audited_at    = now(),
    audit_summary = coalesce(p_summary, audit_summary),
    audit_error   = null,
    place_id      = coalesce(place_id, nullif(p_summary->>'place_id','')),
    website       = coalesce(website, nullif(p_summary->>'website','')),
    updated_at    = now()
  where id = p_project;

  return jsonb_build_object('ok', true, 'updated', n_upd, 'regressed', n_reg,
    'done',  (select count(*) from public.hq_project_items where project_id = p_project and status = 'done'),
    'total', (select count(*) from public.hq_project_items where project_id = p_project and status <> 'na'));
end $$;

-- Which projects the monthly re-check covers: clients who paid (active) or finished (done, on the $97/mo).
create or replace function public.rank_audit_due()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(id order by audited_at nulls first), '[]')
  from public.hq_projects where status in ('active','done')
$$;

-- Service role only. Never anon, never authenticated: the edge function holds the service key.
revoke execute on function public.rank_audit_apply(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.rank_audit_due() from public, anon, authenticated;
grant  execute on function public.rank_audit_apply(uuid, jsonb, jsonb, text) to service_role;
grant  execute on function public.rank_audit_due() to service_role;

-- ---------- HQ: "Re-run audit" without the browser calling the function directly ----------
-- HQ can also call the edge fn with its JWT (it does, so progress shows live). This is the fallback
-- that works from SQL or anywhere pg_net is: it queues the call and returns at once.
create or replace function public.hq_project_audit_run(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if not exists (select 1 from public.hq_projects where id = p_id) then return false; end if;
  perform net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rank-audit',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := jsonb_build_object('project_id', p_id));
  return true;
end $$;
grant execute on function public.hq_project_audit_run(uuid) to authenticated;
revoke execute on function public.hq_project_audit_run(uuid) from public, anon;

-- ---------- HQ reads: score + regressions on the list, evidence on the project ----------
create or replace function public.hq_projects()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'trade', p.trade, 'town', p.town, 'status', p.status,
      'phone', p.phone, 'website', p.website, 'gbp_url', p.gbp_url, 'share_token', p.share_token,
      'business_id', p.business_id, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'audited_at', p.audited_at, 'audit_error', p.audit_error,
      'total', (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status <> 'na'),
      'done',  (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status = 'done'),
      'doing', (select count(*) from public.hq_project_items i where i.project_id = p.id and i.status = 'doing'),
      'regressed', (select count(*) from public.hq_project_items i where i.project_id = p.id and i.regressed)
    ) order by case p.status when 'active' then 0 when 'audit' then 1 when 'pitched' then 2 when 'done' then 3 else 4 end, p.updated_at desc), '[]')
    from public.hq_projects p)
  else null end
$$;
-- hq_project(p_id) already returns to_jsonb(i) for every item, so evidence/auto/checked_at/regressed/next_step
-- ride along with no change. Same for to_jsonb(p) → audited_at/audit_summary/place_id.

-- Nick typing a finding makes it his; clear the regression flag when he touches the step.
create or replace function public.hq_project_item_set(p_id uuid, p_status text default null, p_finding text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update public.hq_project_items set
    status     = coalesce(p_status, status),
    finding    = case when p_finding is null then finding else nullif(trim(p_finding),'') end,
    auto       = case when p_finding is null then auto else false end,
    regressed  = case when p_status is null then regressed else false end,
    updated_at = now()
  where id = p_id;
  update public.hq_projects set updated_at = now() where id = (select project_id from public.hq_project_items where id = p_id);
  return found;
end $$;

-- ---------- the client page: same contract, plus when each line was last checked ----------
-- Still never phone / email / notes / business_id / evidence / next_step.
create or replace function public.audit_public(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name, 'trade', p.trade, 'town', p.town, 'website', p.website, 'status', p.status,
    'updated_at', p.updated_at, 'audited_at', p.audited_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('grp', i.grp, 'label', i.label, 'how', i.how, 'status', i.status, 'finding', i.finding, 'checked_at', i.checked_at) order by i.ord), '[]')
              from public.hq_project_items i where i.project_id = p.id))
  from public.hq_projects p
  where p.share_token = p_token and length(p_token) >= 16
$$;
grant execute on function public.audit_public(text) to anon, authenticated;

-- ---------- monthly re-check (pg_cron + pg_net, same pattern as rx-review-engine) ----------
-- 1st of every month, 11:40 UTC (6:40am ET). The function checks x-rx-sync-secret (RX_SYNC_SECRET in rx_config).
select cron.unschedule(jobid) from cron.job where jobname = 'rank-audit-monthly';
select cron.schedule('rank-audit-monthly', '40 11 1 * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rank-audit',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{"mode":"monthly"}'::jsonb)
$cron$);

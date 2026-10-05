-- TB HQ — Nick's one-screen CRM over every lead table + the receptionist backend. tbsol.net/hq/
-- Access: only auth users listed in hq_admins. Everything the page reads goes through SECURITY DEFINER RPCs
-- that check is_hq_admin(), so no per-table anon/authenticated policies are widened.

create table if not exists public.hq_admins (user_id uuid primary key references auth.users(id) on delete cascade, added_at timestamptz default now());
alter table public.hq_admins enable row level security;
create policy hq_admins_self on public.hq_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_hq_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.hq_admins where user_id = auth.uid()) $$;

-- One pipeline across intakes, client_leads, lsa_leads, plumbing_leads, rx_messages (unhandled callbacks)
create or replace function public.hq_pipeline(p_days int default 90) returns table (
  src text, id text, created_at timestamptz, name text, business text, phone text, email text,
  summary text, status text, value_hint text, notes text
) language sql stable security definer set search_path = public as $$
  select * from (
    select 'intake'::text src, i.id::text, i.created_at, i.name, i.business, i.phone, i.email,
      concat_ws(' · ', nullif(i.interest,''), nullif(i.goal,''), nullif(i.budget,''), nullif(i.timeline,'')) summary,
      coalesce(i.status,'new') status, i.budget value_hint, i.notes
    from intakes i
  union all
    select 'lsa', l.id::text, l.created_at, l.name, l.business, l.phone, l.email,
      concat_ws(' · ', l.trade, l.city, 'LSA: '||coalesce(l.lsa_status,'?'), '$'||coalesce(l.monthly_spend::text,'?')||'/mo spend', coalesce(l.calls_per_week::text,'?')||' calls/wk', coalesce(l.missed_pct::text,'?')||'% missed'),
      coalesce(l.status,'new'), '$'||coalesce(l.est_total_mo::int::text,'?')||'/mo bleeding', l.notes
    from lsa_leads l
  union all
    select 'client:'||c.client, c.id::text, c.created_at, c.name, c.company, c.phone, c.email,
      concat_ws(' · ', nullif(c.kind,''), nullif(c.service,''), nullif(c.message,'')),
      coalesce(c.status,'new'), null, c.notes
    from client_leads c
    where c.client not in ('demo','demo-barbers','test','nick','nickshop') and c.client not like 'zz%'  -- test/demo noise
  union all
    select 'dne', p.id::text, p.created_at, p.full_name, 'D N E Contracting', p.phone_number, p.email,
      concat_ws(' · ', p.project_type, p.room_type::text, p.zip, nullif(p.timeline,''), nullif(p.customer_notes,'')),
      coalesce(p.status::text,'new'), case when p.estimated_low is not null then '$'||p.estimated_low||'–'||p.estimated_high else p.budget end, p.notes
    from plumbing_leads p
  union all
    select 'rx-msg', m.id::text, m.created_at, m.caller_name, b.name, m.caller_phone, null,
      concat_ws(' · ', m.body, nullif(m.callback_pref,'')),
      case when m.handled then 'contacted' else 'new' end, null, null
    from rx_messages m join rx_businesses b on b.id = m.business_id
  ) x
  where is_hq_admin() and x.created_at > now() - make_interval(days => p_days)
  order by x.created_at desc
$$;

-- Update status/notes on any lead regardless of which table it lives in
create or replace function public.hq_set_status(p_src text, p_id text, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if p_src = 'intake' then update intakes set status = p_status, notes = coalesce(p_notes, notes) where id = p_id::bigint;
  elsif p_src = 'lsa' then update lsa_leads set status = p_status, notes = coalesce(p_notes, notes) where id = p_id::uuid;
  elsif p_src like 'client:%' then update client_leads set status = p_status, notes = coalesce(p_notes, notes) where id = p_id::bigint;
  elsif p_src = 'dne' then update plumbing_leads set notes = coalesce(p_notes, notes) where id = p_id::uuid; -- status is an enum; leave to DNE portal
  elsif p_src = 'rx-msg' then update rx_messages set handled = (p_status <> 'new') where id = p_id::uuid;
  end if;
end $$;

-- Receptionist backend in one call
create or replace function public.hq_rx(p_days int default 30) returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'name',name,'trade',trade,'owner_name',owner_name,'owner_phone',owner_phone,'agent_number',agent_number,'active',active,'created_at',created_at) order by created_at), '[]') from rx_businesses),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'business',b.name,'caller_phone',c.caller_phone,'started_at',c.started_at,'duration_s',c.duration_s,'outcome',c.outcome,'urgency',c.urgency,'summary',c.summary,'recording_url',c.recording_url,'owner_notified',c.owner_notified,'caller_texted',c.caller_texted) order by c.started_at desc), '[]')
              from rx_calls c join rx_businesses b on b.id=c.business_id where c.created_at > now() - make_interval(days => p_days)),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'business',b.name,'customer_name',j.customer_name,'customer_phone',j.customer_phone,'address',j.address,'issue',j.issue,'urgency',j.urgency,'window_start',j.window_start,'window_end',j.window_end,'status',j.status,'fee',j.quoted_fee_cents/100.0,'external_ref',j.external_ref,'created_at',j.created_at) order by j.created_at desc), '[]')
              from rx_jobs j join rx_businesses b on b.id=j.business_id where j.created_at > now() - make_interval(days => p_days)),
    'stats', (select jsonb_build_object(
        'calls', (select count(*) from rx_calls where created_at > now() - make_interval(days => p_days)),
        'jobs', (select count(*) from rx_jobs where created_at > now() - make_interval(days => p_days)),
        'booked_value', (select coalesce(sum(quoted_fee_cents),0)/100 from rx_jobs where created_at > now() - make_interval(days => p_days)),
        'unhandled_msgs', (select count(*) from rx_messages where not handled)))
  ) else null end
$$;

create or replace function public.hq_rx_job_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin if not is_hq_admin() then raise exception 'not admin'; end if; update rx_jobs set status = p_status where id = p_id; end $$;

grant execute on function public.is_hq_admin(), public.hq_pipeline(int), public.hq_set_status(text,text,text,text), public.hq_rx(int), public.hq_rx_job_status(uuid,text) to authenticated;
revoke execute on function public.hq_pipeline(int), public.hq_set_status(text,text,text,text), public.hq_rx(int), public.hq_rx_job_status(uuid,text) from anon;

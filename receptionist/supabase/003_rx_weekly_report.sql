-- Weekly report per business (called by n8n every Monday 7am, or ad hoc).
-- select * from rx_weekly_report(7);
create or replace function public.rx_weekly_report(days int default 7)
returns table (business_id uuid, business_name text, owner_phone text, calls bigint, booked bigint, messages bigint, missed_texted bigint, after_hours_calls bigint, est_revenue_saved_cents bigint)
language sql security definer set search_path = public as $$
  select b.id, b.name, b.owner_phone,
    (select count(*) from rx_calls c where c.business_id=b.id and c.created_at > now() - make_interval(days=>days)),
    (select count(*) from rx_jobs j where j.business_id=b.id and j.created_at > now() - make_interval(days=>days) and j.status <> 'cancelled'),
    (select count(*) from rx_messages m where m.business_id=b.id and m.created_at > now() - make_interval(days=>days) and m.handled=false),
    (select count(*) from rx_calls c where c.business_id=b.id and c.created_at > now() - make_interval(days=>days) and c.caller_texted),
    (select count(*) from rx_calls c where c.business_id=b.id and c.created_at > now() - make_interval(days=>days)
       and (extract(hour from c.created_at at time zone b.timezone) < 7 or extract(hour from c.created_at at time zone b.timezone) >= 17 or extract(dow from c.created_at at time zone b.timezone) in (0,6))),
    -- rough value of booked work: quoted dispatch fee (or $150) + $350 average ticket per job
    (select coalesce(sum(coalesce(j.quoted_fee_cents, b.service_fee_cents, 15000)),0) + 35000*count(*) from rx_jobs j where j.business_id=b.id and j.created_at > now() - make_interval(days=>days) and j.status <> 'cancelled')
  from rx_businesses b where b.active;
$$;
revoke all on function public.rx_weekly_report(int) from public, anon, authenticated;
-- rx_calls.caller_texted was added in 001 (missed-call text-back flag)

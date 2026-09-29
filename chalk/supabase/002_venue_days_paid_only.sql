-- Walk-ups who paid cash at the bar are not part of the venue payout (the bar already has the cash).
create or replace function chalk_venue_days(p_venue uuid, p_days int default 30)
returns table(day date, matches int, bar_cents bigint, platform_cents bigint, tips_cents bigint, event_cents bigint)
language sql stable security definer set search_path = public as $$
  with days as (
    select (current_date - (n || ' days')::interval)::date as day from generate_series(0, p_days - 1) n
  ),
  m as (
    select (ended_at at time zone 'America/New_York')::date as day, count(*) c, sum(bar_cents) b, sum(platform_cents) p
      from chalk_matches where venue_id = p_venue and status = 'completed' group by 1
  ),
  t as (
    select (created_at at time zone 'America/New_York')::date as day, sum(amount_cents) s
      from chalk_tips where venue_id = p_venue and status <> 'refunded' group by 1
  ),
  e as (
    select (ee.created_at at time zone 'America/New_York')::date as day,
           sum(ev.entry_cents - floor(ev.entry_cents * v.event_platform_fee_bps / 10000.0)) s
      from chalk_event_entries ee
      join chalk_events ev on ev.id = ee.event_id
      join chalk_venues v on v.id = ev.venue_id
     where ev.venue_id = p_venue and ee.status in ('paid','checked_in') and ee.payment_id is not null group by 1
  )
  select d.day, coalesce(m.c,0)::int, coalesce(m.b,0)::bigint, coalesce(m.p,0)::bigint, coalesce(t.s,0)::bigint, coalesce(e.s,0)::bigint
    from days d left join m on m.day = d.day left join t on t.day = d.day left join e on e.day = d.day
   order by d.day desc;
$$;

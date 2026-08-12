-- ============================================================================
-- HOW POINTS ARE EARNED — the ledger, the shop's rules, and the visit engine.
--
-- WHY THIS EXISTS
--
-- A punch card rewards behaviour that was going to happen anyway, and the
-- reward lands as a 100%-discounted cut in a chair that could have held a
-- paying customer. The mechanics here reward the things a shop actually wants
-- more of — a shorter gap between cuts, a Tuesday instead of a Saturday, a
-- slot booked at the register before the client walks out — none of which
-- discount the cut currently being paid for.
--
-- EVERY MECHANIC DEFAULTS OFF. Nine shops are live. Turning any of this on by
-- default would silently change what their customers earn overnight, so a
-- shop with no `earning` blob behaves exactly as it did before this file
-- existed: points_per_visit, once, and nothing else.
--
-- THE LEDGER IS THE POINT OF THE WHOLE THING
--
-- `reward_members.lifetime` counts POINTS, not visits, and points come from
-- spins, surveys, referrals, games and now four bonus mechanics. Anything
-- that tried to reason about a client's VISIT RHYTHM by reading `lifetime`
-- was reading noise — the first cut of the win-back list did exactly that and
-- flagged every customer in the shop as overdue, because a few arcade spins
-- made a six-week client look like a weekly one.
--
-- So every movement now writes a typed row. "How many times has he actually
-- sat in the chair" is `count(*) where kind='BASE_VISIT'` — a query, not a
-- guess. Adding bonus mechanics without this would have poured more inflation
-- into the same column and quietly degraded every visit-derived feature in
-- the product.
--
-- Anything reasoning about visit rhythm MUST count BASE_VISIT rows. Never
-- lifetime.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) The ledger
-- ----------------------------------------------------------------------------
create table if not exists public.reward_points_ledger (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  client         text        not null,
  member_id      bigint      not null,
  member_code    text,
  appointment_id bigint,                    -- reward_appointments.id when the shop books through Loop
  points         integer     not null,      -- + earned, − redeemed
  kind           text        not null,
  meta           jsonb       not null default '{}'::jsonb
);

comment on table public.reward_points_ledger is
  'Every point movement, typed. kind vocabulary: BASE_VISIT, VELOCITY_BONUS, '
  'MIDWEEK_BONUS, REBOOK_BONUS, REDEMPTION, OPENING_BALANCE. Visit-rhythm '
  'features must count BASE_VISIT rows, never reward_members.lifetime.';

create index if not exists rpl_client_created on public.reward_points_ledger (client, created_at desc);
create index if not exists rpl_member         on public.reward_points_ledger (member_id, created_at desc);
create index if not exists rpl_visits         on public.reward_points_ledger (client, member_id) where kind = 'BASE_VISIT';

alter table public.reward_points_ledger enable row level security;
-- No policies on purpose: reachable only through the SECURITY DEFINER RPCs.

-- Opening balance, so the ledger reconciles with what members already hold.
-- Without it every existing member looks like they earned nothing before today
-- and sum(ledger) silently disagrees with reward_members.lifetime. Guarded by
-- NOT EXISTS so re-running this file cannot double-credit anybody.
insert into public.reward_points_ledger (client, member_id, member_code, points, kind, meta, created_at)
select m.client, m.id, m.code, coalesce(m.lifetime,0), 'OPENING_BALANCE',
       jsonb_build_object('note','points held before the ledger existed'),
       coalesce(m.created_at, now())
from public.reward_members m
where not exists (
  select 1 from public.reward_points_ledger l
  where l.member_id = m.id and l.kind = 'OPENING_BALANCE');

-- ----------------------------------------------------------------------------
-- 2) The shop's rules. One jsonb, same shape as milestone/lottery.
--
-- A whitelist, like site_sanitize: unknown keys are dropped, every number is
-- clamped, and a malformed value falls back to all-off rather than taking the
-- barber's entire save down with it.
-- ----------------------------------------------------------------------------
alter table public.reward_settings add column if not exists earning jsonb;

create or replace function public.earning_sanitize(p jsonb)
returns jsonb language plpgsql immutable as $$
declare
  out_j jsonb;
  days  jsonb := '[]'::jsonb;
  pdays jsonb := '[]'::jsonb;
  d     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;

  -- VELOCITY. Rewards the short GAP rather than the running total, which is
  -- the only one of these that changes behaviour instead of paying for it:
  -- it buys a shorter return cycle without discounting anything.
  out_j := jsonb_build_object('velocity', jsonb_build_object(
    'on',     lower(coalesce(p#>>'{velocity,on}','')) in ('true','t','1','yes','on'),
    'days',   least(90, greatest(3,  coalesce((p#>>'{velocity,days}')::int,   25))),
    'points', least(500, greatest(1, coalesce((p#>>'{velocity,points}')::int, 10)))));

  -- MID-WEEK. Point inflation instead of a cash discount, aimed at the chairs
  -- that sit empty on a Tuesday. ISO weekday, 1=Mon .. 7=Sun.
  if jsonb_typeof(coalesce(p#>'{midweek,days}','null'::jsonb)) = 'array' then
    for d in select jsonb_array_elements_text(p#>'{midweek,days}') loop
      if d ~ '^[1-7]$' and not (days @> to_jsonb(d::int)) then days := days || to_jsonb(d::int); end if;
    end loop;
  end if;
  if jsonb_array_length(days) = 0 then days := '[2,3]'::jsonb; end if;
  out_j := out_j || jsonb_build_object('midweek', jsonb_build_object(
    'on',     lower(coalesce(p#>>'{midweek,on}','')) in ('true','t','1','yes','on'),
    'days',   days,
    'points', least(500, greatest(1, coalesce((p#>>'{midweek,points}')::int, 10)))));

  -- RE-BOOK AT THE REGISTER. The only mechanic that locks in future revenue on
  -- the spot, and it costs the shop nothing at all.
  out_j := out_j || jsonb_build_object('rebook', jsonb_build_object(
    'on',     lower(coalesce(p#>>'{rebook,on}','')) in ('true','t','1','yes','on'),
    'points', least(500, greatest(1, coalesce((p#>>'{rebook,points}')::int, 10)))));

  -- PEAK PROTECTION, and a deliberate note on framing: this is the only one of
  -- the four that takes something AWAY. A customer who saved 100 points and is
  -- told it costs 150 on Saturday reads that as the goalposts moving, which is
  -- the classic way a loyalty scheme breeds resentment rather than loyalty.
  -- `mult` is therefore capped at double, and a shop can express the identical
  -- margin protection as an off-peak discount instead — same economics,
  -- opposite feeling. Off by default either way.
  if jsonb_typeof(coalesce(p#>'{peak,days}','null'::jsonb)) = 'array' then
    for d in select jsonb_array_elements_text(p#>'{peak,days}') loop
      if d ~ '^[1-7]$' and not (pdays @> to_jsonb(d::int)) then pdays := pdays || to_jsonb(d::int); end if;
    end loop;
  end if;
  if jsonb_array_length(pdays) = 0 then pdays := '[5,6]'::jsonb; end if;   -- Fri/Sat
  out_j := out_j || jsonb_build_object('peak', jsonb_build_object(
    'on',   lower(coalesce(p#>>'{peak,on}','')) in ('true','t','1','yes','on'),
    'days', pdays,
    'from', least(23, greatest(0, coalesce((p#>>'{peak,from}')::int, 9))),
    'to',   least(24, greatest(1, coalesce((p#>>'{peak,to}')::int,  14))),
    'mult', least(200, greatest(100, coalesce((p#>>'{peak,mult}')::int, 100)))));  -- percent; 100 = unchanged

  return out_j;
exception when others then
  return jsonb_build_object(
    'velocity', jsonb_build_object('on',false,'days',25,'points',10),
    'midweek',  jsonb_build_object('on',false,'days','[2,3]'::jsonb,'points',10),
    'rebook',   jsonb_build_object('on',false,'points',10),
    'peak',     jsonb_build_object('on',false,'days','[5,6]'::jsonb,'from',9,'to',14,'mult',100));
end $$;

revoke execute on function public.earning_sanitize(jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) The visit engine.
--
-- add_visit is the single most important RPC in the product — it is how every
-- point gets earned — so this keeps the old contract exactly: same PIN gate,
-- same 35-day streak maths, same returned shape. It only ADDS the mechanics,
-- one typed ledger row per component, and an `earned`/`breakdown` pair the
-- card uses to show the customer what they just picked up and why.
--
-- Awards are collected into `cand` and posted in one pass, so there is exactly
-- one place that writes the ledger and one place that moves the balance. (An
-- earlier cut declared a nested procedure per award; plpgsql has no such
-- thing.)
-- ----------------------------------------------------------------------------
create or replace function public.add_visit(p_code text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  m public.reward_members; s public.reward_settings;
  v_streak int; er jsonb; tz text;
  gap_days int; dow int; total int := 0;
  cand jsonb := '[]'::jsonb; e jsonb;
  appt_id bigint;
  -- A velocity bonus rewards coming back SOONER. It must not reward coming
  -- back TWICE: a gap of zero days satisfies "within 25 days", so a
  -- double-punch at the register — or a barber's slip of the thumb — would
  -- mint the bonus again and again, and a customer who noticed could farm it.
  -- Nobody gets a genuine second haircut inside 48 hours. A correctness guard,
  -- not a lever a shop should be tuning, so it is a constant.
  VELOCITY_FLOOR_DAYS constant int := 2;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client = m.client;
  perform public.pin_gate(m.client, p_pin, s.pin);
  if s.pin is distinct from p_pin then return jsonb_build_object('error','wrong PIN'); end if;

  er := public.earning_sanitize(coalesce(s.earning,'{}'::jsonb));
  tz := coalesce(s.book_tz,'America/New_York');
  dow := extract(isodow from (now() at time zone tz))::int;

  -- the appointment this visit belongs to, when the shop books through Loop
  select a.id into appt_id
    from public.reward_appointments a
   where a.client = m.client and a.member_code = m.code
     and (a.start_at at time zone tz)::date = (now() at time zone tz)::date
     and a.status <> 'cancelled'
   order by a.start_at desc limit 1;

  if m.last_visit_at is null then v_streak := 1;
  elsif now() - m.last_visit_at <= interval '35 days' then v_streak := coalesce(m.streak,0) + 1;
  else v_streak := 1;
  end if;

  cand := cand || jsonb_build_object(
    'kind','BASE_VISIT','points',greatest(1,coalesce(s.points_per_visit,1)),
    'label','Visit','meta','{}'::jsonb);

  if (er#>>'{velocity,on}')::boolean and m.last_visit_at is not null then
    gap_days := greatest(0, ((now() at time zone tz)::date - (m.last_visit_at at time zone tz)::date));
    if gap_days between VELOCITY_FLOOR_DAYS and (er#>>'{velocity,days}')::int then
      cand := cand || jsonb_build_object(
        'kind','VELOCITY_BONUS','points',(er#>>'{velocity,points}')::int,
        'label','Back within ' || (er#>>'{velocity,days}') || ' days',
        'meta', jsonb_build_object('gap_days', gap_days));
    end if;
  end if;

  if (er#>>'{midweek,on}')::boolean and (er#>'{midweek,days}') @> to_jsonb(dow) then
    cand := cand || jsonb_build_object(
      'kind','MIDWEEK_BONUS','points',(er#>>'{midweek,points}')::int,
      'label','Mid-week visit','meta', jsonb_build_object('isodow', dow));
  end if;

  -- Matched on the DAY. Two timestamps taken moments apart are never equal, so
  -- an equality test between "booked at" and "finished at" would look correct
  -- and silently never fire.
  if (er#>>'{rebook,on}')::boolean and exists (
      select 1 from public.reward_appointments a
       where a.client = m.client and a.member_code = m.code
         and a.status = 'confirmed' and a.start_at > now()
         and (a.created_at at time zone tz)::date = (now() at time zone tz)::date)
  then
    cand := cand || jsonb_build_object(
      'kind','REBOOK_BONUS','points',(er#>>'{rebook,points}')::int,
      'label','Booked your next one','meta','{}'::jsonb);
  end if;

  for e in select jsonb_array_elements(cand) loop
    if (e->>'points')::int > 0 then
      total := total + (e->>'points')::int;
      insert into public.reward_points_ledger
        (client, member_id, member_code, appointment_id, points, kind, meta)
      values (m.client, m.id, m.code, appt_id, (e->>'points')::int, e->>'kind', e->'meta');
    end if;
  end loop;

  update public.reward_members
     set points = points + total, lifetime = lifetime + total,
         streak = v_streak, last_visit_at = now()
   where id = m.id returning * into m;

  return (to_jsonb(m) - 'phone')
       || jsonb_build_object('reward_at', s.reward_at, 'reward_text', s.reward_text,
                             'earned', total, 'breakdown', cand);
end $$;

-- ----------------------------------------------------------------------------
-- VERIFIED AGAINST A SCRATCH SHOP, since this touches every shop's earning:
--   · no rules set          → 1 point, BASE_VISIT only (identical to before)
--   · all three on          → 1 + 10 + 5 + 7 = 23, four typed ledger rows
--   · 40 days since last    → velocity does not fire
--   · booking made yesterday→ re-book does not fire
--   · punched twice in a day→ velocity fires once, second punch is base only
--   · sum(ledger) == reward_members.lifetime
--   · all 9 live shops: earning is null, no mechanic enabled
-- ----------------------------------------------------------------------------

-- Chalk: pay-to-play bar games, staff tips, events.
-- All tables are chalk_* in public (house convention on the shared "Base" project).
-- RLS is on with no policies: only the service role (server) can touch these.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- venues
create table if not exists chalk_venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  city text,
  address text,
  timezone text not null default 'America/New_York',
  prize_mode text not null default 'cash' check (prize_mode in ('cash','gift_card')),
  stake_options_cents int[] not null default '{500,1000}',
  -- split of the pot (two entries), in basis points. defaults: winner 60%, bar 20%, platform 20%
  winner_bps int not null default 6000,
  bar_bps int not null default 2000,
  platform_bps int not null default 2000,
  tip_platform_fee_bps int not null default 500,
  event_platform_fee_bps int not null default 1000,
  event_service_fee_cents int not null default 150,
  free_until date,                      -- launch partner: platform's game cut goes to the bar until this date
  owner_name text,
  owner_phone text,
  stripe_account_id text,
  stripe_onboarded boolean not null default false,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz not null default now(),
  constraint chalk_venues_split check (winner_bps + bar_bps + platform_bps = 10000)
);

-- ---------------------------------------------------------------- stations (a pool table, a dartboard)
create table if not exists chalk_stations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references chalk_venues(id) on delete cascade,
  code text unique not null,
  name text not null,
  game text not null default 'pool' check (game in ('pool','darts','shuffleboard','cornhole','air_hockey','other')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists chalk_stations_venue on chalk_stations(venue_id);

-- ---------------------------------------------------------------- players
create table if not exists chalk_players (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,                 -- E.164
  first_name text not null,
  balance_cents int not null default 0 check (balance_cents >= 0),
  verified_at timestamptz,
  birthdate date,
  stripe_account_id text,
  stripe_onboarded boolean not null default false,
  flags int not null default 0,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- ---------------------------------------------------------------- staff
create table if not exists chalk_staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references chalk_venues(id) on delete cascade,
  name text not null,
  phone text not null,
  role text not null default 'bartender' check (role in ('bartender','manager','owner')),
  pin_hash text,
  stripe_account_id text,
  stripe_onboarded boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, phone)
);

-- ---------------------------------------------------------------- matches
create table if not exists chalk_matches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references chalk_venues(id),
  station_id uuid not null references chalk_stations(id),
  game text not null default 'pool',
  stake_cents int not null,
  pot_cents int not null,
  winner_cents int not null,
  bar_cents int not null,
  platform_cents int not null,
  prize_mode text not null default 'cash',
  status text not null default 'open' check (status in ('open','live','completed','voided','disputed')),
  player_a_id uuid references chalk_players(id),
  player_b_id uuid references chalk_players(id),
  a_paid boolean not null default false,
  b_paid boolean not null default false,
  a_pick uuid,
  b_pick uuid,
  first_pick_at timestamptz,
  winner_id uuid references chalk_players(id),
  settled_by_staff_id uuid references chalk_staff(id),
  void_reason text,
  opened_at timestamptz not null default now(),
  live_at timestamptz,
  ended_at timestamptz,
  venue_settlement_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists chalk_matches_station_status on chalk_matches(station_id, status);
create index if not exists chalk_matches_venue_created on chalk_matches(venue_id, created_at desc);

-- ---------------------------------------------------------------- payments (one card charge)
create table if not exists chalk_payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references chalk_players(id),
  venue_id uuid references chalk_venues(id),
  kind text not null check (kind in ('entry','tip','ticket','load')),
  match_id uuid references chalk_matches(id),
  match_slot text check (match_slot in ('a','b')),
  event_entry_id uuid,
  amount_cents int not null,
  entry_cents int not null default 0,
  tip_cents int not null default 0,
  tip_staff_id uuid references chalk_staff(id),
  fee_cents int not null default 0,
  method text not null default 'card' check (method in ('card','balance','demo')),
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  refunded_cents int not null default 0,
  stripe_refund_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists chalk_payments_match on chalk_payments(match_id);
create index if not exists chalk_payments_player on chalk_payments(player_id, created_at desc);

-- ---------------------------------------------------------------- ledger (player balance movements)
create table if not exists chalk_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references chalk_players(id),
  kind text not null check (kind in ('win','entry','refund','cashout','load','adjust','gift_card')),
  amount_cents int not null,
  balance_after_cents int not null,
  match_id uuid references chalk_matches(id),
  payment_id uuid references chalk_payments(id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists chalk_ledger_player on chalk_ledger(player_id, created_at desc);

-- ---------------------------------------------------------------- tips
create table if not exists chalk_tips (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references chalk_venues(id),
  staff_id uuid not null references chalk_staff(id),
  player_id uuid references chalk_players(id),
  match_id uuid references chalk_matches(id),
  payment_id uuid references chalk_payments(id),
  amount_cents int not null,
  platform_fee_cents int not null default 0,
  staff_cents int not null,
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  settlement_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists chalk_tips_staff on chalk_tips(staff_id, created_at desc);
create index if not exists chalk_tips_venue on chalk_tips(venue_id, created_at desc);

-- ---------------------------------------------------------------- events
create table if not exists chalk_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references chalk_venues(id) on delete cascade,
  name text not null,
  game text not null default 'pool',
  format text not null default 'single_elim' check (format in ('single_elim','round_robin')),
  entry_cents int not null default 1500,
  service_fee_cents int not null default 150,
  capacity int not null default 16,
  starts_at timestamptz not null,
  prize_text text,
  status text not null default 'open' check (status in ('draft','open','live','done','cancelled')),
  venue_settlement_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists chalk_events_venue on chalk_events(venue_id, starts_at desc);

create table if not exists chalk_event_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references chalk_events(id) on delete cascade,
  player_id uuid references chalk_players(id),
  display_name text not null,
  phone text,
  payment_id uuid references chalk_payments(id),
  status text not null default 'pending' check (status in ('pending','paid','checked_in','refunded','withdrawn')),
  seed int,
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists chalk_event_entries_event on chalk_event_entries(event_id);

create table if not exists chalk_bracket_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references chalk_events(id) on delete cascade,
  round int not null,
  position int not null,
  entry_a_id uuid references chalk_event_entries(id),
  entry_b_id uuid references chalk_event_entries(id),
  winner_entry_id uuid references chalk_event_entries(id),
  next_match_id uuid references chalk_bracket_matches(id),
  next_slot text check (next_slot in ('a','b')),
  status text not null default 'pending' check (status in ('pending','ready','done','bye')),
  unique (event_id, round, position)
);

-- ---------------------------------------------------------------- settlements (money out)
create table if not exists chalk_settlements (
  id uuid primary key default gen_random_uuid(),
  payee_type text not null check (payee_type in ('venue','staff','player')),
  venue_id uuid references chalk_venues(id),
  staff_id uuid references chalk_staff(id),
  player_id uuid references chalk_players(id),
  period_start date,
  period_end date,
  amount_cents int not null,
  stripe_transfer_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed','skipped')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ---------------------------------------------------------------- otp + webhook dedupe
create table if not exists chalk_otp (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  purpose text not null default 'login',
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chalk_otp_phone on chalk_otp(phone, created_at desc);

create table if not exists chalk_webhook_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------- RLS: server only
do $$
declare t text;
begin
  foreach t in array array['chalk_venues','chalk_stations','chalk_players','chalk_staff','chalk_matches','chalk_payments',
    'chalk_ledger','chalk_tips','chalk_events','chalk_event_entries','chalk_bracket_matches','chalk_settlements','chalk_otp','chalk_webhook_events']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- atomic balance movement
create or replace function chalk_adjust_balance(
  p_player uuid, p_delta int, p_kind text, p_match uuid default null, p_payment uuid default null, p_note text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  update chalk_players
     set balance_cents = balance_cents + p_delta
   where id = p_player
   returning balance_cents into v_new;
  if v_new is null then raise exception 'player not found'; end if;
  if v_new < 0 then raise exception 'insufficient balance'; end if;
  insert into chalk_ledger(player_id, kind, amount_cents, balance_after_cents, match_id, payment_id, note)
  values (p_player, p_kind, p_delta, v_new, p_match, p_payment, p_note);
  return v_new;
end $$;

-- ---------------------------------------------------------------- leaderboards
create or replace function chalk_top_tippers(p_venue uuid, p_since timestamptz, p_limit int default 10)
returns table(first_name text, total_cents bigint, tips int)
language sql stable security definer set search_path = public as $$
  select p.first_name, sum(t.amount_cents)::bigint, count(*)::int
    from chalk_tips t join chalk_players p on p.id = t.player_id
   where t.venue_id = p_venue and t.created_at >= p_since and t.status <> 'refunded'
   group by p.id, p.first_name
   order by 2 desc, 3 desc
   limit p_limit;
$$;

create or replace function chalk_top_players(p_venue uuid, p_since timestamptz, p_limit int default 10)
returns table(first_name text, wins int, played int, won_cents bigint)
language sql stable security definer set search_path = public as $$
  with played as (
    select m.id, m.winner_id, m.winner_cents, unnest(array[m.player_a_id, m.player_b_id]) as pid
      from chalk_matches m
     where m.venue_id = p_venue and m.status = 'completed' and m.ended_at >= p_since
  )
  select p.first_name,
         sum(case when played.winner_id = played.pid then 1 else 0 end)::int as wins,
         count(*)::int as played,
         sum(case when played.winner_id = played.pid then played.winner_cents else 0 end)::bigint as won_cents
    from played join chalk_players p on p.id = played.pid
   group by p.id, p.first_name
   order by 2 desc, 3 desc
   limit p_limit;
$$;

-- ---------------------------------------------------------------- venue daily rollup (owner dashboard)
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
           sum(ev.entry_cents - (ev.entry_cents * v.event_platform_fee_bps / 10000)) s
      from chalk_event_entries ee
      join chalk_events ev on ev.id = ee.event_id
      join chalk_venues v on v.id = ev.venue_id
     where ev.venue_id = p_venue and ee.status in ('paid','checked_in') group by 1
  )
  select d.day, coalesce(m.c,0)::int, coalesce(m.b,0)::bigint, coalesce(m.p,0)::bigint, coalesce(t.s,0)::bigint, coalesce(e.s,0)::bigint
    from days d left join m on m.day = d.day left join t on t.day = d.day left join e on e.day = d.day
   order by d.day desc;
$$;

-- ============================================================================
-- Loop Booking — real self-service appointments (the Booksy-killer)
-- ----------------------------------------------------------------------------
-- Adds a proper appointment engine on top of the existing loyalty card:
--   * services (name / duration / price), barbers, and open hours per shop
--   * server-side slot generation that is conflict-aware (no double-booking)
--   * real appointments table + owner agenda + status management
-- Everything here is ADDITIVE and backward-compatible. Existing loyalty RPCs
-- (get_member, add_visit, spin_wheel, loyalty_owner_dashboard, …) are untouched.
-- If a shop has no booking config, the customer card falls back to the old
-- free-text "request a time" flow, so nothing breaks before setup.
-- ============================================================================

-- 1) Per-shop booking config lives on reward_settings (additive columns) -------
alter table public.reward_settings add column if not exists services      jsonb   default '[]'::jsonb;   -- [{id,name,mins,price}]
alter table public.reward_settings add column if not exists staff         jsonb   default '[]'::jsonb;   -- [{id,name}]  (barbers/chairs; empty = single chair)
alter table public.reward_settings add column if not exists hours         jsonb   default '{}'::jsonb;   -- {"1":["09:00","18:00"], … } keys = ISO weekday 1..7 (Mon..Sun)
alter table public.reward_settings add column if not exists book_tz       text    default 'America/New_York';
alter table public.reward_settings add column if not exists slot_every    integer default 15;           -- slot granularity, minutes
alter table public.reward_settings add column if not exists lead_mins     integer default 90;           -- minimum notice before a slot can be booked
alter table public.reward_settings add column if not exists horizon_days  integer default 30;           -- how far out customers can book
alter table public.reward_settings add column if not exists deposit_note  text;                         -- optional policy line shown at confirm

-- 2) Appointments -------------------------------------------------------------
create table if not exists public.reward_appointments (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  client      text        not null,
  member_code text,
  name        text,
  phone       text,
  service     jsonb,                       -- {id,name,mins,price}
  mins        integer     not null default 30,
  staff_id    text,
  staff_name  text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  status      text        not null default 'confirmed',  -- confirmed | cancelled | done | noshow
  note        text,
  source      text        default 'card'
);
create index if not exists reward_appts_client_start on public.reward_appointments (client, start_at);
create index if not exists reward_appts_conflict     on public.reward_appointments (client, staff_id, start_at) where status = 'confirmed';

alter table public.reward_appointments enable row level security;
-- No public policies: all access is through the SECURITY DEFINER RPCs below.

-- 3) booking_config — public read of a shop's booking setup --------------------
create or replace function public.booking_config(p_client text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  return jsonb_build_object(
    'ok', true,
    'client', s.client,
    'biz_name', coalesce(s.biz_name, initcap(s.client)),
    'booking_on', coalesce(s.booking_on, true),
    'services', coalesce(s.services, '[]'::jsonb),
    'staff', coalesce(s.staff, '[]'::jsonb),
    'hours', coalesce(s.hours, '{}'::jsonb),
    'book_tz', coalesce(s.book_tz, 'America/New_York'),
    'slot_every', coalesce(s.slot_every, 15),
    'lead_mins', coalesce(s.lead_mins, 90),
    'horizon_days', coalesce(s.horizon_days, 30),
    'deposit_note', s.deposit_note
  );
end $$;

-- 4) booking_slots — open start times for a date/barber/duration ---------------
--    Returns jsonb array of "HH:MM" local wall-clock strings, conflict-aware.
create or replace function public.booking_slots(p_client text, p_date text, p_staff text, p_mins integer)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  s public.reward_settings; tz text; every int; leadm int; horizon int; cap int;
  d date; dow int; win jsonb; open_min int; close_min int; mins int;
  slot_start timestamptz; slot_end timestamptz; earliest timestamptz;
  m int; c int; out_arr text[] := '{}';
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found or coalesce(s.booking_on, true) = false then return '[]'::jsonb; end if;
  tz := coalesce(s.book_tz, 'America/New_York');
  every := greatest(5, coalesce(s.slot_every, 15));
  leadm := greatest(0, coalesce(s.lead_mins, 90));
  horizon := coalesce(s.horizon_days, 30);
  mins := greatest(5, coalesce(p_mins, 30));

  begin d := p_date::date; exception when others then return '[]'::jsonb; end;
  if d < (now() at time zone tz)::date then return '[]'::jsonb; end if;
  if d > ((now() at time zone tz)::date + horizon) then return '[]'::jsonb; end if;

  dow := extract(isodow from d);                       -- 1..7 (Mon..Sun)
  win := coalesce(s.hours, '{}'::jsonb) -> dow::text;
  if win is null or jsonb_array_length(win) < 2 then return '[]'::jsonb; end if;
  open_min  := (split_part(win->>0,':',1))::int * 60 + (split_part(win->>0,':',2))::int;
  close_min := (split_part(win->>1,':',1))::int * 60 + (split_part(win->>1,':',2))::int;

  cap := greatest(1, coalesce(jsonb_array_length(s.staff), 0));
  if coalesce(p_staff,'') <> '' then cap := 1; end if;         -- a specific barber = capacity 1
  earliest := now() + make_interval(mins => leadm);

  m := open_min;
  while m + mins <= close_min loop
    slot_start := (d::timestamp + make_interval(mins => m)) at time zone tz;
    slot_end   := slot_start + make_interval(mins => mins);
    if slot_start >= earliest then
      select count(*) into c from public.reward_appointments a
        where a.client = lower(p_client) and a.status = 'confirmed'
          and a.start_at < slot_end and slot_start < a.end_at
          and (coalesce(p_staff,'') = '' or a.staff_id = p_staff);
      if c < cap then
        out_arr := array_append(out_arr, to_char(slot_start at time zone tz, 'HH24:MI'));
      end if;
    end if;
    m := m + every;
  end loop;

  return coalesce(to_jsonb(out_arr), '[]'::jsonb);
end $$;

-- 5) book_appointment — reserve a real slot (double-book safe) -----------------
create or replace function public.book_appointment(
  p_client text, p_member_code text, p_name text, p_phone text,
  p_service jsonb, p_staff_id text, p_date text, p_time text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  s public.reward_settings; tz text; mins int; cap int; c int;
  slot_start timestamptz; slot_end timestamptz;
  chosen_id text; chosen_name text; st jsonb; svc_name text; svc jsonb;
  new_id bigint; when_txt text;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'Shop not found.'); end if;
  if coalesce(s.booking_on, true) = false then return jsonb_build_object('ok', false, 'error', 'Online booking is off right now.'); end if;

  tz := coalesce(s.book_tz, 'America/New_York');
  svc  := coalesce(p_service, '{}'::jsonb);
  mins := greatest(5, coalesce((svc->>'mins')::int, 30));
  svc_name := coalesce(nullif(svc->>'name',''), 'Appointment');

  begin
    slot_start := (p_date::date::timestamp + p_time::time) at time zone tz;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'That time looks invalid — pick a slot again.');
  end;
  slot_end := slot_start + make_interval(mins => mins);
  if slot_start < now() then return jsonb_build_object('ok', false, 'error', 'That time is already in the past.'); end if;

  -- serialize bookings per shop so two people cannot grab the same slot
  perform pg_advisory_xact_lock(hashtext('loopbk:' || lower(p_client)));

  cap := greatest(1, coalesce(jsonb_array_length(s.staff), 0));
  if coalesce(p_staff_id,'') <> '' then cap := 1; end if;

  select count(*) into c from public.reward_appointments a
    where a.client = lower(p_client) and a.status = 'confirmed'
      and a.start_at < slot_end and slot_start < a.end_at
      and (coalesce(p_staff_id,'') = '' or a.staff_id = p_staff_id);
  if c >= cap then
    return jsonb_build_object('ok', false, 'error', 'Just booked — please pick another time.');
  end if;

  -- resolve which barber this lands on
  if coalesce(p_staff_id,'') <> '' then
    chosen_id := p_staff_id;
    select st2->>'name' into chosen_name
      from jsonb_array_elements(coalesce(s.staff,'[]'::jsonb)) st2 where st2->>'id' = p_staff_id limit 1;
  elsif coalesce(jsonb_array_length(s.staff),0) > 0 then
    -- "any barber": pick the first one with no conflict at this time
    for st in select * from jsonb_array_elements(coalesce(s.staff,'[]'::jsonb)) loop
      select count(*) into c from public.reward_appointments a
        where a.client = lower(p_client) and a.status = 'confirmed'
          and a.start_at < slot_end and slot_start < a.end_at and a.staff_id = st->>'id';
      if c = 0 then chosen_id := st->>'id'; chosen_name := st->>'name'; exit; end if;
    end loop;
  end if;

  insert into public.reward_appointments
    (client, member_code, name, phone, service, mins, staff_id, staff_name, start_at, end_at, status, note, source)
  values
    (lower(p_client), nullif(p_member_code,''), p_name, p_phone, svc, mins, chosen_id, chosen_name,
     slot_start, slot_end, 'confirmed', nullif(p_note,''), 'card')
  returning id into new_id;

  when_txt := to_char(slot_start at time zone tz, 'Dy Mon DD, HH12:MI AM');

  -- mirror into client_leads so it also shows in the existing CRM / owner dashboard
  begin
    insert into public.client_leads (client, kind, name, phone, service, ride_date, message, status)
    values (lower(p_client), 'booking', coalesce(p_name,'Member'), p_phone, svc_name, when_txt,
            '📅 ' || svc_name || (case when chosen_name is not null then ' with '||chosen_name else '' end)
              || ' — ' || when_txt || coalesce(' · '||nullif(p_note,''),''), 'Booked');
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'id', new_id, 'when', when_txt,
    'staff_name', chosen_name, 'service', svc_name,
    'start_at', slot_start, 'mins', mins);
end $$;

-- 6) booking_admin — owner day/range agenda (PIN protected) --------------------
create or replace function public.booking_admin(p_client text, p_pin text, p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; tz text; d0 date; d1 date; rows jsonb;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  if s.pin is null or p_pin is null or s.pin <> p_pin then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  tz := coalesce(s.book_tz, 'America/New_York');
  begin d0 := coalesce(nullif(p_from,'')::date, (now() at time zone tz)::date); exception when others then d0 := (now() at time zone tz)::date; end;
  begin d1 := coalesce(nullif(p_to,'')::date, d0 + 30); exception when others then d1 := d0 + 30; end;

  select coalesce(jsonb_agg(x order by x_start), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', a.id, 'name', a.name, 'phone', a.phone,
      'service', coalesce(a.service->>'name','Appointment'),
      'mins', a.mins, 'staff_name', a.staff_name, 'status', a.status,
      'start_at', a.start_at, 'note', a.note,
      'date', to_char(a.start_at at time zone tz, 'YYYY-MM-DD'),
      'day',  to_char(a.start_at at time zone tz, 'Dy Mon DD'),
      'time', to_char(a.start_at at time zone tz, 'HH12:MI AM'),
      'price', (a.service->>'price')
    ) as x, a.start_at as x_start
    from public.reward_appointments a
    where a.client = lower(p_client)
      and (a.start_at at time zone tz)::date between d0 and d1
  ) t;

  return jsonb_build_object('ok', true, 'tz', tz, 'appts', rows);
end $$;

-- 7) booking_set_status — confirm / cancel / done / noshow (PIN protected) -----
create or replace function public.booking_set_status(p_client text, p_pin text, p_id bigint, p_status text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  if s.pin is null or p_pin is null or s.pin <> p_pin then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  if p_status not in ('confirmed','cancelled','done','noshow') then
    return jsonb_build_object('ok', false, 'error', 'bad status');
  end if;
  update public.reward_appointments set status = p_status
    where id = p_id and client = lower(p_client);
  return jsonb_build_object('ok', true);
end $$;

-- 8) save_booking_config — owner sets services / hours / barbers (PIN) ---------
create or replace function public.save_booking_config(
  p_client text, p_pin text, p_services jsonb, p_staff jsonb, p_hours jsonb,
  p_slot_every integer, p_lead_mins integer, p_horizon_days integer,
  p_book_tz text, p_deposit_note text, p_booking_on boolean)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  if s.pin is null or p_pin is null or s.pin <> p_pin then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  update public.reward_settings set
    services     = coalesce(p_services, services),
    staff        = coalesce(p_staff, staff),
    hours        = coalesce(p_hours, hours),
    slot_every   = coalesce(p_slot_every, slot_every),
    lead_mins    = coalesce(p_lead_mins, lead_mins),
    horizon_days = coalesce(p_horizon_days, horizon_days),
    book_tz      = coalesce(nullif(p_book_tz,''), book_tz),
    deposit_note = p_deposit_note,
    booking_on   = coalesce(p_booking_on, booking_on)
  where client = lower(p_client);
  return jsonb_build_object('ok', true);
end $$;

-- 9) Grants — these RPCs are called with the anon key from the browser ---------
grant execute on function public.booking_config(text)                                             to anon, authenticated;
grant execute on function public.booking_slots(text, text, text, integer)                         to anon, authenticated;
grant execute on function public.book_appointment(text, text, text, text, jsonb, text, text, text, text) to anon, authenticated;
grant execute on function public.booking_admin(text, text, text, text)                            to anon, authenticated;
grant execute on function public.booking_set_status(text, text, bigint, text)                     to anon, authenticated;
grant execute on function public.save_booking_config(text, text, jsonb, jsonb, jsonb, integer, integer, integer, text, text, boolean) to anon, authenticated;

-- ============================================================================
-- Reward + prize-game difficulty editor (barber dashboard)
-- ============================================================================
alter table public.reward_settings add column if not exists game_difficulty text default 'normal';

create or replace function public.loyalty_settings_get(p_client text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if not found then return jsonb_build_object('ok', false, 'error', 'No program with that code.'); end if;
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  return jsonb_build_object(
    'ok', true, 'client', s.client, 'biz_name', s.biz_name,
    'reward_text', coalesce(s.reward_text,'a reward'),
    'reward_at', coalesce(s.reward_at,5),
    'points_per_visit', coalesce(s.points_per_visit,1),
    'spin_cost', coalesce(s.spin_cost,2),
    'survey_points', coalesce(s.survey_points,1),
    'spin_prizes', coalesce(s.spin_prizes,'[]'::jsonb),
    'booking_on', coalesce(s.booking_on,true),
    'google_review_url', s.google_review_url,
    'game_difficulty', coalesce(s.game_difficulty,'normal'));
end $$;

create or replace function public.save_reward_settings(
  p_client text, p_pin text,
  p_reward_text text, p_reward_at integer, p_points_per_visit integer,
  p_spin_cost integer, p_survey_points integer, p_spin_prizes jsonb,
  p_booking_on boolean, p_biz_name text, p_google_review_url text,
  p_game_difficulty text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if not found then return jsonb_build_object('ok', false, 'error', 'No program with that code.'); end if;
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  update public.reward_settings set
    reward_text      = coalesce(nullif(p_reward_text,''), reward_text),
    reward_at        = greatest(1, coalesce(p_reward_at, reward_at)),
    points_per_visit = greatest(1, coalesce(p_points_per_visit, points_per_visit)),
    spin_cost        = greatest(1, coalesce(p_spin_cost, spin_cost)),
    survey_points    = greatest(0, coalesce(p_survey_points, survey_points)),
    spin_prizes      = coalesce(p_spin_prizes, spin_prizes),
    booking_on       = coalesce(p_booking_on, booking_on),
    biz_name         = coalesce(nullif(p_biz_name,''), biz_name),
    google_review_url= coalesce(p_google_review_url, google_review_url),
    game_difficulty  = coalesce(nullif(p_game_difficulty,''), game_difficulty)
  where client = lower(p_client);
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.loyalty_settings_get(text, text) to anon, authenticated;
grant execute on function public.save_reward_settings(text, text, text, integer, integer, integer, integer, jsonb, boolean, text, text, text) to anon, authenticated;

-- ============================================================================
-- Customer-side booking management (view + cancel own upcoming appointments)
-- ============================================================================
create or replace function public.member_appointments(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; tz text; rows jsonb;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  select * into s from public.reward_settings where client = m.client;
  tz := coalesce(s.book_tz, 'America/New_York');
  select coalesce(jsonb_agg(x order by x_start), '[]'::jsonb) into rows from (
    select jsonb_build_object('id', a.id, 'service', coalesce(a.service->>'name','Appointment'),
      'staff_name', a.staff_name, 'start_at', a.start_at, 'mins', a.mins,
      'when', to_char(a.start_at at time zone tz, 'Dy Mon DD, HH12:MI AM')) as x, a.start_at as x_start
    from public.reward_appointments a
    where a.member_code = p_code and a.status = 'confirmed' and a.start_at > now()
  ) t;
  return jsonb_build_object('ok', true, 'appts', rows);
end $$;

create or replace function public.member_cancel_appointment(p_code text, p_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare n int;
begin
  update public.reward_appointments set status = 'cancelled'
    where id = p_id and member_code = p_code and status = 'confirmed' and start_at > now();
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'Could not cancel — it may have already passed.'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.member_appointments(text)              to anon, authenticated;
grant execute on function public.member_cancel_appointment(text, bigint) to anon, authenticated;

-- ============================================================================
-- TB UNIVERSITY — THE CAMPUS BACKEND
-- ----------------------------------------------------------------------------
-- What /university/campus/ runs on: enrolment, lesson progress, the daily
-- checklist and its streak, XP, the wins feed and the leaderboard.
--
-- THE PRICE DECIDES THE DESIGN.
-- A four-figure monthly membership cannot be run by hand. So enrolment is a
-- code the student redeems themselves, every state change is a single RPC that
-- returns the whole new state (one round trip, no client-side bookkeeping to
-- drift out of sync), and the accountability loop is machinery. One student and
-- four hundred cost the same to operate; the only manual act left is minting
-- codes when someone pays, which is one function call.
--
-- AUTH is the estate's existing shape: email + 4-digit PIN, checked inside
-- SECURITY DEFINER functions, sitting behind pin_gate() — the same brute-force
-- throttle every shop RPC uses. Nothing here is readable with the anon key
-- alone: the tables are RLS-on with no anon policies, so the ONLY way in is
-- through these functions, and every one of them starts by authenticating.
--
-- WHY THE XP NUMBERS LIVE IN TWO PLACES.
-- The client shows "+80 XP" before the server confirms it, because a tap that
-- waits on a network feels broken. The server is still the only writer — it
-- recomputes every award from its own constants and returns the true total,
-- which the client then adopts. If the two ever disagree, the server wins on
-- the next render. Keep uni_xp_* below in step with TBU_XP in curriculum.js.
--
-- Idempotent: safe to run whole, repeatedly, in Supabase → SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------- constants
create or replace function public.uni_xp_lesson()   returns int language sql immutable as $$ select 40 $$;
create or replace function public.uni_xp_mission()  returns int language sql immutable as $$ select 40 $$;
create or replace function public.uni_xp_daily()    returns int language sql immutable as $$ select 10 $$;
create or replace function public.uni_xp_dailyall() returns int language sql immutable set search_path='public','pg_temp' as $$ select 40 $$;
create or replace function public.uni_xp_win()      returns int language sql immutable as $$ select 30 $$;
create or replace function public.uni_xp_streak7()  returns int language sql immutable as $$ select 150 $$;
create or replace function public.uni_daily_count() returns int language sql immutable set search_path='public','pg_temp' as $$ select 6 $$;

-- ------------------------------------------------------------------- tables
create table if not exists public.uni_invites(
  code        text primary key,
  plan        text not null default 'monthly',      -- monthly | founding | scholarship | team
  max_uses    int  not null default 1,
  uses        int  not null default 0,
  expires_at  timestamptz,
  note        text,                                 -- who it was minted for
  created_at  timestamptz not null default now()
);
alter table public.uni_invites enable row level security;
revoke all on public.uni_invites from anon, authenticated;

create table if not exists public.uni_students(
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  pin           text not null,                      -- 4 digits, throttled by pin_gate
  goal          text,
  xp            int  not null default 0,
  streak        int  not null default 0,
  best_streak   int  not null default 0,
  last_full_day date,                               -- last day all six were ticked
  status        text not null default 'active',     -- active | paused | cancelled
  plan          text,
  paid_until    date,
  invite_code   text references public.uni_invites(code),
  path          jsonb,                              -- the student's own plan; see uni_path_set
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create unique index if not exists uni_students_email_idx on public.uni_students(lower(btrim(email)));
alter table public.uni_students enable row level security;
revoke all on public.uni_students from anon;

create table if not exists public.uni_lesson_progress(
  student_id uuid not null references public.uni_students(id) on delete cascade,
  lesson_id  text not null,
  proof      text,
  created_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
alter table public.uni_lesson_progress enable row level security;
revoke all on public.uni_lesson_progress from anon;

create table if not exists public.uni_days(
  student_id uuid not null references public.uni_students(id) on delete cascade,
  day        date not null,
  items      text[] not null default '{}',
  full_done  boolean not null default false,
  primary key (student_id, day)
);
alter table public.uni_days enable row level security;
revoke all on public.uni_days from anon;

-- The XP ledger exists for one reason the running total cannot serve: a
-- leaderboard for THIS WEEK. Without it, a student who did the work in March
-- outranks one who did it yesterday, forever, and the board stops motivating
-- anybody who joined late.
create table if not exists public.uni_xp_log(
  id         bigserial primary key,
  student_id uuid not null references public.uni_students(id) on delete cascade,
  kind       text not null,                         -- lesson | mission | daily | dailyall | streak7 | win
  amount     int  not null,
  ref        text,
  created_at timestamptz not null default now()
);
create index if not exists uni_xp_log_student_idx on public.uni_xp_log(student_id, created_at desc);
create index if not exists uni_xp_log_recent_idx  on public.uni_xp_log(created_at desc);
alter table public.uni_xp_log enable row level security;
revoke all on public.uni_xp_log from anon;

create table if not exists public.uni_wins(
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.uni_students(id) on delete cascade,
  body       text not null,
  amount     numeric,
  hidden     boolean not null default false,        -- moderation, without deleting
  created_at timestamptz not null default now()
);
create index if not exists uni_wins_recent_idx on public.uni_wins(created_at desc) where not hidden;
alter table public.uni_wins enable row level security;
revoke all on public.uni_wins from anon;

-- Admin (you, signed in to /hq) can see everything through normal RLS; the
-- student side never touches these policies because it never authenticates.
do $$ begin
  execute 'drop policy if exists "admin reads uni students" on public.uni_students';
  execute 'create policy "admin reads uni students" on public.uni_students for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
  execute 'drop policy if exists "admin reads uni wins" on public.uni_wins';
  execute 'create policy "admin reads uni wins" on public.uni_wins for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
  execute 'drop policy if exists "admin reads uni invites" on public.uni_invites';
  execute 'create policy "admin reads uni invites" on public.uni_invites for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
end $$;

-- ------------------------------------------------------------------ helpers
create or replace function public.uni_rank(p_xp int)
returns text language sql immutable set search_path='public','pg_temp' as $$
  select case
    when p_xp >= 7500 then 'Operator X'
    when p_xp >= 4000 then 'Rainmaker'
    when p_xp >= 2000 then 'Closer'
    when p_xp >= 900  then 'Operator'
    when p_xp >= 300  then 'Prospector'
    else 'Rookie' end
$$;

-- First name + last initial. The leaderboard and the wins feed are seen by
-- every other student, and nobody enrolled to have their full name published.
create or replace function public.uni_display_name(p_name text)
returns text language sql immutable set search_path='public','pg_temp' as $$
  select case
    when position(' ' in btrim(coalesce(p_name,''))) = 0 then btrim(coalesce(p_name,'Student'))
    else split_part(btrim(p_name),' ',1) || ' ' || upper(left(split_part(btrim(p_name),' ',2),1)) || '.'
  end
$$;

-- pin_gate lives in hq/pin-throttle.sql. This file must be runnable before or
-- after that one, so the call is made only if the function is actually there.
create or replace function public.uni_gate(p_email text, p_pin text, p_real text)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if to_regprocedure('public.pin_gate(text,text,text)') is not null then
    execute 'select public.pin_gate($1,$2,$3)' using 'uni:'||lower(btrim(coalesce(p_email,''))), p_pin, p_real;
  end if;
end $$;

-- Every student-facing function starts here. Returns the row or null; the
-- caller turns null into the one vague error message they all share, because
-- distinguishing "no such student" from "wrong PIN" is free intelligence for
-- someone working through a list of emails.
create or replace function public.uni_auth(p_email text, p_pin text)
returns public.uni_students language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students;
begin
  select * into s from public.uni_students where lower(btrim(email)) = lower(btrim(coalesce(p_email,''))) limit 1;
  if not found then
    perform public.uni_gate(p_email, p_pin, '-');    -- throttle unknown emails too
    return null;
  end if;
  perform public.uni_gate(p_email, p_pin, s.pin);
  if s.pin is distinct from btrim(coalesce(p_pin,'')) then return null; end if;
  update public.uni_students set last_seen_at = now() where id = s.id;
  return s;
end $$;

-- One shape, built in one place: whatever changed, the client gets the whole
-- truth back and re-renders from it.
create or replace function public.uni_state_of(s public.uni_students)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_done json; v_today text[]; v_wins json;
begin
  select coalesce(json_agg(json_build_object('lesson',lesson_id,'at',created_at,'proof',proof) order by created_at), '[]'::json)
    into v_done from public.uni_lesson_progress where student_id = s.id;

  select coalesce(items,'{}') into v_today from public.uni_days where student_id = s.id and day = current_date;
  if v_today is null then v_today := '{}'; end if;

  select coalesce(json_agg(x), '[]'::json) into v_wins from (
    select public.uni_display_name(st.name) as name, w.body, w.amount, w.created_at as at,
           public.uni_rank(st.xp) as rank, (st.id = s.id) as mine
      from public.uni_wins w join public.uni_students st on st.id = w.student_id
     where not w.hidden order by w.created_at desc limit 20) x;

  return json_build_object(
    'ok', true,
    'student', json_build_object(
      'name', s.name, 'email', s.email, 'goal', s.goal, 'xp', s.xp,
      'streak', s.streak, 'best_streak', s.best_streak, 'last_full_day', s.last_full_day,
      'status', s.status, 'plan', s.plan, 'paid_until', s.paid_until, 'joined', s.created_at,
      'rank', public.uni_rank(s.xp), 'path', s.path),
    'done', v_done,
    'today', to_json(v_today),
    'wins', v_wins);
end $$;

-- Award + ledger in one place so the running total and the weekly board can
-- never tell different stories.
create or replace function public.uni_award(p_student uuid, p_kind text, p_amount int, p_ref text)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if p_amount is null or p_amount = 0 then return; end if;
  insert into public.uni_xp_log(student_id, kind, amount, ref) values (p_student, p_kind, p_amount, p_ref);
  update public.uni_students set xp = greatest(0, xp + p_amount) where id = p_student;
end $$;

-- ---------------------------------------------------------------- enrolment
create or replace function public.uni_join(
  p_name text, p_email text, p_pin text, p_goal text default null, p_code text default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_inv public.uni_invites; s public.uni_students; v_email text; v_code text;
begin
  v_email := lower(btrim(coalesce(p_email,'')));
  v_code  := upper(btrim(coalesce(p_code,'')));

  if length(btrim(coalesce(p_name,''))) < 2 then
    return json_build_object('ok',false,'error','Please enter your name.'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('ok',false,'error','That email does not look right.'); end if;
  if btrim(coalesce(p_pin,'')) !~ '^\d{4}$' then
    return json_build_object('ok',false,'error','Your PIN must be 4 digits.'); end if;

  -- Already enrolled: the honest answer is "sign in", not a duplicate account.
  if exists (select 1 from public.uni_students where lower(btrim(email)) = v_email) then
    return json_build_object('ok',false,'error','That email is already enrolled — sign in instead.');
  end if;

  if v_code = '' then
    return json_build_object('ok',false,'need_code',true,'error','You need an enrolment code to join.');
  end if;
  select * into v_inv from public.uni_invites where upper(code) = v_code;
  if not found then
    return json_build_object('ok',false,'need_code',true,'error','That code is not valid.'); end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return json_build_object('ok',false,'need_code',true,'error','That code has expired.'); end if;
  if v_inv.uses >= v_inv.max_uses then
    return json_build_object('ok',false,'need_code',true,'error','That code has already been used.'); end if;

  insert into public.uni_students(email, name, pin, goal, plan, invite_code)
    values (btrim(p_email), btrim(p_name), btrim(p_pin), nullif(btrim(coalesce(p_goal,'')),''), v_inv.plan, v_inv.code)
    returning * into s;
  update public.uni_invites set uses = uses + 1 where code = v_inv.code;

  return public.uni_state_of(s);
end $$;

create or replace function public.uni_state(p_email text, p_pin text)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  if s.status = 'cancelled' then
    return json_build_object('ok',false,'error','Your membership is not active. Email support@tbsol.net to come back.'); end if;
  return public.uni_state_of(s);
end $$;

-- ------------------------------------------------------------------ lessons
create or replace function public.uni_lesson_done(
  p_email text, p_pin text, p_lesson text, p_proof text default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students; v_lesson text; v_proof text; v_new boolean;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  v_lesson := btrim(coalesce(p_lesson,''));
  if v_lesson = '' then return json_build_object('ok',false,'error','Missing lesson.'); end if;
  v_proof := left(btrim(coalesce(p_proof,'')), 600);

  insert into public.uni_lesson_progress(student_id, lesson_id, proof)
    values (s.id, v_lesson, nullif(v_proof,''))
    on conflict (student_id, lesson_id) do nothing;
  v_new := found;

  -- XP is paid once per lesson, ever. Re-reading a lesson is encouraged;
  -- re-earning it is not.
  if v_new then
    perform public.uni_award(s.id, 'lesson', public.uni_xp_lesson(), v_lesson);
    if v_proof <> '' then perform public.uni_award(s.id, 'mission', public.uni_xp_mission(), v_lesson); end if;
  end if;

  select * into s from public.uni_students where id = s.id;
  return public.uni_state_of(s);
end $$;

-- ----------------------------------------------------------- daily checklist
create or replace function public.uni_check(
  p_email text, p_pin text, p_item text, p_on boolean)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students; v_item text; v_items text[]; v_had boolean;
        v_row public.uni_days; v_gap int; v_new_streak int;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  v_item := btrim(coalesce(p_item,''));
  if v_item = '' then return json_build_object('ok',false,'error','Missing item.'); end if;

  insert into public.uni_days(student_id, day) values (s.id, current_date)
    on conflict (student_id, day) do nothing;
  select * into v_row from public.uni_days where student_id = s.id and day = current_date for update;

  v_items := coalesce(v_row.items, '{}');
  v_had := v_item = any(v_items);

  if coalesce(p_on,false) and not v_had then
    v_items := array_append(v_items, v_item);
    perform public.uni_award(s.id, 'daily', public.uni_xp_daily(), v_item);
  elsif not coalesce(p_on,false) and v_had then
    v_items := array_remove(v_items, v_item);
    perform public.uni_award(s.id, 'daily', -public.uni_xp_daily(), v_item);
  end if;

  update public.uni_days set items = v_items where student_id = s.id and day = current_date;

  -- The streak moves once per day, the first time all six are ticked. Unticking
  -- afterwards does not take the day back — the work was done, and a student
  -- tidying their list should not be punished for it.
  if array_length(v_items,1) >= public.uni_daily_count() and not coalesce(v_row.full_done,false) then
    update public.uni_days set full_done = true where student_id = s.id and day = current_date;
    v_gap := case when s.last_full_day is null then null else current_date - s.last_full_day end;
    v_new_streak := case when v_gap = 1 then s.streak + 1 else 1 end;
    update public.uni_students
       set streak = v_new_streak,
           best_streak = greatest(best_streak, v_new_streak),
           last_full_day = current_date
     where id = s.id;
    perform public.uni_award(s.id, 'dailyall', public.uni_xp_dailyall(), current_date::text);
    if v_new_streak % 7 = 0 then
      perform public.uni_award(s.id, 'streak7', public.uni_xp_streak7(), v_new_streak::text);
    end if;
  end if;

  -- A streak is only alive if the last full day was today or yesterday. Nothing
  -- runs on a schedule here, so the lapse is noticed on the next visit instead.
  select * into s from public.uni_students where id = s.id;
  if s.last_full_day is not null and (current_date - s.last_full_day) > 1 and s.streak > 0 then
    update public.uni_students set streak = 0 where id = s.id;
    select * into s from public.uni_students where id = s.id;
  end if;

  return public.uni_state_of(s);
end $$;

-- ---------------------------------------------------------------- wins feed
create or replace function public.uni_win_post(
  p_email text, p_pin text, p_body text, p_amount numeric default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students; v_body text; v_today int; v_paid int;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  v_body := left(btrim(coalesce(p_body,'')), 500);
  if length(v_body) < 10 then return json_build_object('ok',false,'error','Say what happened — a sentence is enough.'); end if;

  select count(*) into v_today from public.uni_wins
   where student_id = s.id and created_at > now() - interval '24 hours';
  if v_today >= 5 then
    return json_build_object('ok',false,'error','Five wins in a day is plenty. Post the next one tomorrow.'); end if;

  insert into public.uni_wins(student_id, body, amount)
    values (s.id, v_body, case when p_amount is null or p_amount <= 0 then null else round(p_amount,2) end);

  -- XP for the first two a day only, so the feed cannot be farmed.
  select count(*) into v_paid from public.uni_xp_log
   where student_id = s.id and kind = 'win' and created_at > now() - interval '24 hours';
  if v_paid < 2 then perform public.uni_award(s.id, 'win', public.uni_xp_win(), null); end if;

  select * into s from public.uni_students where id = s.id;
  return public.uni_state_of(s);
end $$;

create or replace function public.uni_feed(p_limit int default 40)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  select coalesce(json_agg(x), '[]'::json) into v from (
    select public.uni_display_name(st.name) as name, w.body, w.amount, w.created_at as at,
           public.uni_rank(st.xp) as rank
      from public.uni_wins w join public.uni_students st on st.id = w.student_id
     where not w.hidden
     order by w.created_at desc
     limit greatest(1, least(coalesce(p_limit,40), 100))) x;
  return json_build_object('ok', true, 'wins', v);
end $$;

-- --------------------------------------------------------------- leaderboard
create or replace function public.uni_leaderboard(p_scope text default 'all')
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  if lower(coalesce(p_scope,'all')) = 'week' then
    select coalesce(json_agg(x), '[]'::json) into v from (
      select public.uni_display_name(st.name) as name, sum(l.amount)::int as xp, public.uni_rank(st.xp) as rank
        from public.uni_xp_log l join public.uni_students st on st.id = l.student_id
       where l.created_at > now() - interval '7 days' and st.status = 'active'
       group by st.id, st.name, st.xp
      having sum(l.amount) > 0
       order by 2 desc limit 25) x;
  else
    select coalesce(json_agg(x), '[]'::json) into v from (
      select public.uni_display_name(name) as name, xp, public.uni_rank(xp) as rank
        from public.uni_students where status = 'active' and xp > 0
       order by xp desc limit 25) x;
  end if;
  return json_build_object('ok', true, 'rows', v);
end $$;

-- --------------------------------------------------------------------- admin
-- Minting codes is the only manual step between someone paying and someone
-- studying, and it is one call. Admin-only: authenticated as you, in /hq.
create or replace function public.uni_invite_mint(
  p_count int default 1, p_plan text default 'monthly', p_note text default null, p_expires_days int default 30)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_codes text[] := '{}'; v_code text; i int;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  for i in 1..greatest(1, least(coalesce(p_count,1), 100)) loop
    loop
      v_code := 'TBU-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
      exit when not exists (select 1 from public.uni_invites where code = v_code);
    end loop;
    insert into public.uni_invites(code, plan, note, expires_at)
      values (v_code, coalesce(nullif(btrim(coalesce(p_plan,'')),''),'monthly'), p_note,
              case when p_expires_days is null then null else now() + make_interval(days => p_expires_days) end);
    v_codes := array_append(v_codes, v_code);
  end loop;
  return json_build_object('ok', true, 'codes', to_json(v_codes));
end $$;

-- Who is actually studying: the number that tells you whether the membership
-- is working, without opening five tables.
create or replace function public.uni_admin_students()
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  select coalesce(json_agg(x), '[]'::json) into v from (
    select st.name, st.email, st.status, st.plan, st.paid_until, st.xp, public.uni_rank(st.xp) as rank,
           st.streak, st.created_at, st.last_seen_at,
           (select count(*) from public.uni_lesson_progress ld where ld.student_id = st.id) as lessons,
           (select count(*) from public.uni_days dd where dd.student_id = st.id and dd.full_done) as full_days
      from public.uni_students st order by st.created_at desc limit 500) x;
  return json_build_object('ok', true, 'students', v);
end $$;

-- Membership lifecycle: one call when someone pays, pauses or leaves.
create or replace function public.uni_set_status(p_email text, p_status text, p_paid_until date default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  if p_status not in ('active','paused','cancelled') then
    return json_build_object('ok',false,'error','Status must be active, paused or cancelled.'); end if;
  update public.uni_students
     set status = p_status, paid_until = coalesce(p_paid_until, paid_until)
   where lower(btrim(email)) = lower(btrim(coalesce(p_email,'')));
  if not found then return json_build_object('ok',false,'error','No student with that email.'); end if;
  return json_build_object('ok', true);
end $$;

-- --------------------------------------------------------------------- grants
-- The student functions are callable by anon (they authenticate internally);
-- the admin ones are not, and check the JWT on top of that.
grant execute on function public.uni_join(text,text,text,text,text)      to anon, authenticated;
grant execute on function public.uni_state(text,text)                    to anon, authenticated;
grant execute on function public.uni_lesson_done(text,text,text,text)    to anon, authenticated;
grant execute on function public.uni_check(text,text,text,boolean)       to anon, authenticated;
grant execute on function public.uni_win_post(text,text,text,numeric)    to anon, authenticated;
grant execute on function public.uni_feed(int)                           to anon, authenticated;
grant execute on function public.uni_leaderboard(text)                   to anon, authenticated;
grant execute on function public.uni_invite_mint(int,text,text,int)      to authenticated;
grant execute on function public.uni_admin_students()                    to authenticated;
grant execute on function public.uni_set_status(text,text,date)          to authenticated;
-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated DIRECTLY, not only through PUBLIC — so revoking from PUBLIC
-- alone leaves the internal helpers callable with the anon key that ships in
-- every page. All three roles, or none of it counts.
revoke execute on function public.uni_auth(text,text)                    from public, anon, authenticated;
revoke execute on function public.uni_award(uuid,text,int,text)          from public, anon, authenticated;
revoke execute on function public.uni_gate(text,text,text)               from public, anon, authenticated;
revoke execute on function public.uni_state_of(public.uni_students)      from public, anon, authenticated;
revoke execute on function public.uni_invite_mint(int,text,text,int)     from public, anon;
revoke execute on function public.uni_admin_students()                   from public, anon;
revoke execute on function public.uni_set_status(text,text,date)         from public, anon;

-- --------------------------------------------------------------- first codes
-- Five founding codes so the campus is usable the minute this file is run.
-- Mint more with:  select uni_invite_mint(10, 'monthly', 'August intake', 30);
insert into public.uni_invites(code, plan, max_uses, note)
  values ('TBU-FOUND1','founding',1,'founding member'),
         ('TBU-FOUND2','founding',1,'founding member'),
         ('TBU-FOUND3','founding',1,'founding member'),
         ('TBU-FOUND4','founding',1,'founding member'),
         ('TBU-FOUND5','founding',1,'founding member')
  on conflict (code) do nothing;

-- ============================================================================
-- LIVE CALLS
-- ----------------------------------------------------------------------------
-- The campus hosts its own calls rather than posting a Zoom link in a chat:
-- the room is embedded in /university/campus/#/live, so a student never leaves
-- the school to attend, and attendance is recorded — which is the part a Zoom
-- link can never give you. Turning up is worth XP for the same reason the daily
-- checklist is: the behaviour that decides whether someone succeeds here is
-- showing up repeatedly, so that is what the machinery rewards.
--
-- The room itself is a public Jitsi room, which costs nothing and needs no
-- account, so the room NAME is the only thing standing between a call and a
-- stranger. Hence the generated 16-hex name below — never a guessable one like
-- "tbu-office-hours". Swap the embed for Daily/Whereby/LiveKit later if
-- recording or a waiting room becomes worth paying for; nothing else changes.
-- ============================================================================
create or replace function public.uni_xp_live() returns int language sql immutable set search_path='public','pg_temp' as $$ select 60 $$;

create table if not exists public.uni_events(
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  minutes     int not null default 60,
  room        text not null default ('tbu-' || replace(gen_random_uuid()::text,'-','')),
  host        text default 'Nick',
  replay_url  text,
  cancelled   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists uni_events_when_idx on public.uni_events(starts_at desc);
alter table public.uni_events enable row level security;
revoke all on public.uni_events from anon;

create table if not exists public.uni_attendance(
  student_id uuid not null references public.uni_students(id) on delete cascade,
  event_id   uuid not null references public.uni_events(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (student_id, event_id)
);
alter table public.uni_attendance enable row level security;
revoke all on public.uni_attendance from anon;

do $$ begin
  execute 'drop policy if exists "admin manages uni events" on public.uni_events';
  execute 'create policy "admin manages uni events" on public.uni_events for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
end $$;

-- What the Live tab renders: what is coming, and what was recorded. The room
-- name is only handed out from an hour before until an hour after — before
-- that it is not in the payload at all, so a leaked screenshot of the schedule
-- is not a leaked room.
create or replace function public.uni_events_list(p_email text, p_pin text)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students; v_up json; v_past json;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;

  select coalesce(json_agg(x order by x.starts_at), '[]'::json) into v_up from (
    select e.id, e.title, e.description, e.starts_at, e.minutes, e.host,
           case when now() between e.starts_at - interval '1 hour'
                             and e.starts_at + make_interval(mins => e.minutes) + interval '1 hour'
                then e.room else null end as room,
           (now() between e.starts_at - interval '10 minutes'
                      and e.starts_at + make_interval(mins => e.minutes) + interval '30 minutes') as joinable,
           exists(select 1 from public.uni_attendance a where a.event_id = e.id and a.student_id = s.id) as attended
      from public.uni_events e
     where not e.cancelled
       and e.starts_at > now() - make_interval(mins => e.minutes) - interval '1 hour'
     order by e.starts_at limit 20) x;

  select coalesce(json_agg(y order by y.starts_at desc), '[]'::json) into v_past from (
    select e.id, e.title, e.starts_at, e.host, e.replay_url,
           exists(select 1 from public.uni_attendance a where a.event_id = e.id and a.student_id = s.id) as attended
      from public.uni_events e
     where not e.cancelled
       and e.starts_at <= now() - make_interval(mins => e.minutes) - interval '1 hour'
     order by e.starts_at desc limit 12) y;

  return json_build_object('ok',true,'upcoming',v_up,'past',v_past);
end $$;

create or replace function public.uni_event_attend(p_email text, p_pin text, p_event uuid)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students; e public.uni_events; v_new boolean;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  select * into e from public.uni_events where id = p_event and not cancelled;
  if not found then return json_build_object('ok',false,'error','That call is not on.'); end if;
  -- Attendance can only be claimed while the room is actually open, so nobody
  -- collects the XP by opening the schedule on a Tuesday.
  if now() < e.starts_at - interval '10 minutes'
     or now() > e.starts_at + make_interval(mins => e.minutes) + interval '30 minutes' then
    return json_build_object('ok',false,'error','That room is not open right now.');
  end if;

  insert into public.uni_attendance(student_id, event_id) values (s.id, e.id)
    on conflict (student_id, event_id) do nothing;
  v_new := found;
  if v_new then perform public.uni_award(s.id, 'live', public.uni_xp_live(), e.id::text); end if;

  select * into s from public.uni_students where id = s.id;
  return json_build_object('ok',true,'room',e.room,'state',public.uni_state_of(s));
end $$;

create or replace function public.uni_event_upsert(
  p_id uuid, p_title text, p_starts_at timestamptz, p_minutes int,
  p_description text default null, p_host text default null, p_replay_url text default null,
  p_cancelled boolean default false)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare e public.uni_events;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  if length(btrim(coalesce(p_title,''))) < 3 then
    return json_build_object('ok',false,'error','Give the call a title.'); end if;
  if p_starts_at is null then
    return json_build_object('ok',false,'error','When does it start?'); end if;

  if p_id is null then
    insert into public.uni_events(title, description, starts_at, minutes, host, replay_url, cancelled)
      values (btrim(p_title), nullif(btrim(coalesce(p_description,'')),''), p_starts_at,
              greatest(10, least(coalesce(p_minutes,60), 480)), nullif(btrim(coalesce(p_host,'')),''),
              nullif(btrim(coalesce(p_replay_url,'')),''), coalesce(p_cancelled,false))
      returning * into e;
  else
    update public.uni_events
       set title = btrim(p_title),
           description = nullif(btrim(coalesce(p_description,'')),''),
           starts_at = p_starts_at,
           minutes = greatest(10, least(coalesce(p_minutes,60), 480)),
           host = coalesce(nullif(btrim(coalesce(p_host,'')),''), host),
           replay_url = nullif(btrim(coalesce(p_replay_url,'')),''),
           cancelled = coalesce(p_cancelled,false)
     where id = p_id returning * into e;
    if not found then return json_build_object('ok',false,'error','No such call.'); end if;
  end if;
  return json_build_object('ok',true,'event',row_to_json(e));
end $$;

create or replace function public.uni_events_admin()
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  select coalesce(json_agg(x order by x.starts_at desc), '[]'::json) into v from (
    select e.*, (select count(*) from public.uni_attendance a where a.event_id = e.id) as attended
      from public.uni_events e order by e.starts_at desc limit 100) x;
  return json_build_object('ok',true,'events',v);
end $$;

grant execute on function public.uni_events_list(text,text)                        to anon, authenticated;
grant execute on function public.uni_event_attend(text,text,uuid)                  to anon, authenticated;
revoke execute on function public.uni_event_upsert(uuid,text,timestamptz,int,text,text,text,boolean) from public, anon;
revoke execute on function public.uni_events_admin()                               from public, anon;
grant execute on function public.uni_event_upsert(uuid,text,timestamptz,int,text,text,text,boolean) to authenticated;
grant execute on function public.uni_events_admin()                                to authenticated;

-- ============================================================================
-- PERSONAL PATHS
-- ----------------------------------------------------------------------------
-- A fixed syllabus is the one thing this school said it would not be, and the
-- app was quietly doing it anyway — "next lesson" meant "next in my order",
-- which is a curriculum with extra steps. A path is the student's own answer to
-- three questions, stored so it follows them across devices and so the campus
-- opens on THEIR next move.
--
-- Deliberately jsonb and deliberately unvalidated: the shape of a path will
-- change as the curriculum grows, and a student halfway through one should
-- never be broken by that.
-- ============================================================================
alter table public.uni_students add column if not exists path jsonb;

create or replace function public.uni_path_set(p_email text, p_pin text, p_path jsonb)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare s public.uni_students;
begin
  s := public.uni_auth(p_email, p_pin);
  if s.id is null then return json_build_object('ok',false,'error','Wrong email or PIN.'); end if;
  -- A path can always be rewritten. Changing your mind about what you are
  -- building is not a failure state and must never be treated as one.
  update public.uni_students
     set path = p_path,
         goal = coalesce(nullif(btrim(coalesce(p_path->>'goalText','')),''), goal)
   where id = s.id;
  select * into s from public.uni_students where id = s.id;
  return public.uni_state_of(s);
end $$;

grant execute on function public.uni_path_set(text,text,jsonb) to anon, authenticated;

-- NOTE: uni_state_of() gains 'path' in its student object. It is redefined in
-- the migration that adds the column; if you are running this file fresh, the
-- definition above already includes it.

-- ============================================================================
-- APPLICATIONS → ENROLMENT
-- ----------------------------------------------------------------------------
-- University applications land in `intakes` with every other lead on the
-- estate, which is right — one inbox, not five. What was missing is the last
-- step: seeing the University ones on their own, knowing whether that person is
-- already a student, and minting their code without copying an email address
-- between two tabs. That gap is where applicants go cold.
-- ============================================================================
create or replace function public.uni_applications(p_limit int default 100)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) into v from (
    select i.id, i.name, i.email, i.phone, i.goal, i.timeline, i.notes, i.status, i.created_at,
           exists(select 1 from public.uni_students st
                   where lower(btrim(st.email)) = lower(btrim(coalesce(i.email,'')))) as enrolled,
           (select st.status from public.uni_students st
             where lower(btrim(st.email)) = lower(btrim(coalesce(i.email,''))) limit 1) as student_status
      from public.intakes i
     where i.interest ilike '%University%' or i.about ilike '%University%' or i.notes ilike '%University%'
     order by i.created_at desc
     limit greatest(1, least(coalesce(p_limit,100), 500))) x;
  return json_build_object('ok', true, 'applications', v);
end $$;

-- Mint a code AND tie it to the applicant in one call. The note is what makes
-- an unredeemed code chaseable a week later instead of an anonymous string.
create or replace function public.uni_invite_for(p_email text, p_name text default null, p_plan text default 'monthly', p_expires_days int default 30)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_code text; v_exists boolean;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  if coalesce(btrim(p_email),'') = '' then
    return json_build_object('ok',false,'error','No email on that application.'); end if;

  select exists(select 1 from public.uni_students where lower(btrim(email)) = lower(btrim(p_email))) into v_exists;
  if v_exists then return json_build_object('ok',false,'error','That person is already enrolled.'); end if;

  -- An unused code already minted for this person is reused rather than
  -- stacking up spares that all still work.
  select code into v_code from public.uni_invites
   where note = 'applicant: ' || lower(btrim(p_email)) and uses < max_uses
     and (expires_at is null or expires_at > now())
   order by created_at desc limit 1;

  if v_code is null then
    loop
      v_code := 'TBU-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
      exit when not exists (select 1 from public.uni_invites where code = v_code);
    end loop;
    insert into public.uni_invites(code, plan, note, expires_at)
      values (v_code, coalesce(nullif(btrim(coalesce(p_plan,'')),''),'monthly'),
              'applicant: ' || lower(btrim(p_email)),
              case when p_expires_days is null then null else now() + make_interval(days => p_expires_days) end);
  end if;

  update public.intakes set status = 'invited'
   where lower(btrim(coalesce(email,''))) = lower(btrim(p_email))
     and (interest ilike '%University%' or about ilike '%University%' or notes ilike '%University%')
     and coalesce(status,'') <> 'invited';

  return json_build_object('ok', true, 'code', v_code, 'name', coalesce(nullif(btrim(coalesce(p_name,'')),''),'there'),
                           'link', 'https://tbsol.net/university/campus/?code=' || v_code);
end $$;

revoke execute on function public.uni_applications(int)              from public, anon;
revoke execute on function public.uni_invite_for(text,text,text,int) from public, anon;
grant  execute on function public.uni_applications(int)              to authenticated;
grant  execute on function public.uni_invite_for(text,text,text,int) to authenticated;

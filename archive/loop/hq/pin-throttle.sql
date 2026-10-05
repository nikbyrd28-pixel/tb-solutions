-- ============================================================================
-- Loop — PIN brute-force throttle
-- ----------------------------------------------------------------------------
-- THE PROBLEM
-- Shop PINs are 4 numeric digits (create_loop_shop allows 4–8, the signup form
-- asks for 4, and all 9 shops in the database today are 4). Every owner RPC is
-- SECURITY DEFINER and executable by anon. The anon key ships in the page
-- source and the shop slug is in the URL, so anyone could sit on
-- crm_members(slug, '0000'..'9999') and walk out with every customer's name,
-- phone number and visit history in about ten thousand requests. There was no
-- throttle, no lockout and no record that it had happened.
--
-- Lengthening PINs is not available: it would lock out existing owners, who
-- cannot be reached to be told. So instead, make guessing cost time.
--
-- WHY IT HAD TO COVER EVERYTHING
-- Partial coverage would have been worthless. If crm_members were throttled but
-- loyalty_settings_get were not, an attacker would brute-force the soft
-- endpoint as an oracle and then spend the discovered PIN on crm_members once.
-- The gate is therefore wired into every function that validates a PIN — 27
-- against reward_settings.pin, plus affiliate_dashboard against affiliates.pin
-- under a namespaced key.
--
-- WHY THE WIRING IS ADDITIVE
-- Each function keeps its own PIN check exactly as it was; the gate is inserted
-- as one line immediately before it. Error shapes and messages are therefore
-- untouched, and the original check remains as a backstop, so the only new
-- behaviour is the lockout. The migration asserts, per function, that the new
-- source is byte-identical to the old apart from the inserted line.
-- ============================================================================

create table if not exists public.pin_attempts(
  client       text primary key,   -- shop slug, or 'aff:CODE' for a rep
  fails        int not null default 0,
  locks        int not null default 0,   -- lifetime lock count; drives escalation
  last_fail_at timestamptz,
  locked_until timestamptz
);
alter table public.pin_attempts enable row level security;   -- no policies: RPC-only
revoke all on public.pin_attempts from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Thresholds are deliberately generous. An owner who mistypes gives up long
-- before 15 consecutive failures, so a legitimate user cannot reach a lock —
-- and any correct PIN clears the streak outright. An attacker drops to 15
-- guesses per 15 minutes, then per hour, then per six hours, which turns ten
-- thousand guesses from a coffee break into months.
--
-- THE ONE SUBTLE PART, and the reason this function looks the way it does:
-- a RAISE rolls back everything written in the same transaction. The first cut
-- armed the lock and raised together, so Postgres discarded the lock on the way
-- out — `fails` could never get past 14, no lock ever persisted, and a correct
-- guess still returned data. The throttle was decorative and the probe caught
-- it. So: the only path that raises is the entry check, which writes nothing.
-- Arming the lock happens on the wrong-PIN path, which returns normally and
-- lets the caller emit its own "Wrong PIN.", so the write commits and the lock
-- bites from the next call on. Do not "tidy" this by raising after the update.
--
-- KNOWN TRADE-OFF: someone who knows a slug can deliberately lock its owner out
-- for 15 minutes. That is strictly better than handing over the customer list,
-- but it is a real cost and worth revisiting if it ever bites a shop.
-- ----------------------------------------------------------------------------
create or replace function public.pin_gate(p_client text, p_pin text, p_real text)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare a public.pin_attempts; c text := lower(btrim(coalesce(p_client,''))); wait_min int; left_min int; n int;
begin
  if c = '' then return; end if;
  select * into a from public.pin_attempts where client = c;

  -- A streak that has gone quiet for a day is forgotten, so an owner who
  -- fumbled last week does not start today part-way to a lock.
  if a.client is not null and coalesce(a.locked_until, '-infinity'::timestamptz) <= now()
     and coalesce(a.last_fail_at, '-infinity'::timestamptz) < now() - interval '24 hours' then
    delete from public.pin_attempts where client = c;
    a := null;
  end if;

  -- The ONLY raise, and it writes nothing.
  if a.locked_until is not null and a.locked_until > now() then
    left_min := greatest(1, ceil(extract(epoch from (a.locked_until - now()))/60))::int;
    raise exception 'Too many wrong PIN tries. Try again in % min.', left_min
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_real,'') <> '' and coalesce(p_pin,'') = p_real then
    if a.client is not null then delete from public.pin_attempts where client = c; end if;
    return;                                   -- correct: streak cleared
  end if;

  insert into public.pin_attempts(client, fails, last_fail_at) values (c, 1, now())
  on conflict (client) do update
    set fails = public.pin_attempts.fails + 1, last_fail_at = now()
  returning fails into n;

  if n >= 15 then
    wait_min := case a.locks when 0 then 15 when 1 then 60 else 360 end;
    update public.pin_attempts
      set fails = 0, locks = locks + 1, locked_until = now() + make_interval(mins => wait_min)
      where client = c;
  end if;
  -- Deliberately no raise here: the caller's own check returns the ordinary
  -- "Wrong PIN.", the transaction commits, and the lock survives.
end $$;

revoke all on function public.pin_gate(text,text,text) from public, anon, authenticated;
-- No grant: only the SECURITY DEFINER callers reach it, so anon cannot poke the
-- counter directly to lock a shop out.

-- ----------------------------------------------------------------------------
-- THE WIRING (migrations pin_bruteforce_throttle_wiring and
-- pin_throttle_affiliate_dashboard). Re-runnable: it skips anything already
-- carrying the guard, so it also picks up any PIN-checking function added later.
-- Run it again after writing a new owner RPC.
-- ----------------------------------------------------------------------------
do $mig$
declare
  r record; def2 text; src_before text; src_after text; stripped text;
  pat text := '(?n)^(\s*)(if\s+(?:coalesce\(s\.pin|s\.pin))';
  ins text; done int := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def, p.prosrc,
           case when pg_get_function_identity_arguments(p.oid) like '%p_client text%' then 'p_client'
                else 'm.client' end as client_expr
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and pg_get_function_identity_arguments(p.oid) like '%p_pin text%'
      and p.prosrc ~ 's\.pin'
      and p.prosrc !~ 'pin_gate'
  loop
    src_before := r.prosrc;
    ins := '\1perform public.pin_gate(' || r.client_expr || ', p_pin, s.pin);' || chr(10) || '\1\2';

    if (select count(*) from regexp_matches(r.def, pat, 'g')) <> 1 then
      raise exception 'ABORT: % has % pin checks, expected 1', r.proname,
        (select count(*) from regexp_matches(r.def, pat, 'g'));
    end if;

    def2 := regexp_replace(r.def, pat, ins);
    execute def2;

    select prosrc into src_after from pg_proc where oid = r.oid;

    -- strip the line we added; what remains must be byte-identical to before
    stripped := regexp_replace(src_after, '(?n)^\s*perform public\.pin_gate\([^;]*\);\n', '');
    if stripped <> src_before then
      raise exception 'ABORT: % changed beyond the inserted guard', r.proname;
    end if;
    if (select count(*) from regexp_matches(src_after, 'pin_gate', 'g')) <> 1 then
      raise exception 'ABORT: % has the guard % times', r.proname,
        (select count(*) from regexp_matches(src_after, 'pin_gate', 'g'));
    end if;

    done := done + 1;
  end loop;
  raise notice 'pin_gate wired into % functions', done;
end $mig$;

-- affiliate_dashboard checks a rep PIN from public.affiliates, not a shop PIN,
-- so it was never an oracle for reward_settings.pin — but it is its own
-- brute-force surface. Keyed 'aff:CODE' so a rep lockout cannot collide with a
-- shop slug.
do $mig$
declare def2 text; src_before text; src_after text; stripped text; o oid;
  pat text := '(?n)^(\s*)(if\s+coalesce\(a\.pin)';
begin
  select p.oid into o from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='affiliate_dashboard';
  select prosrc into src_before from pg_proc where oid=o;
  if src_before ~ 'pin_gate' then raise notice 'already wired'; return; end if;

  select regexp_replace(pg_get_functiondef(o), pat,
    '\1perform public.pin_gate(''aff:''||upper(coalesce(p_code,'''')), p_pin, a.pin);' || chr(10) || '\1\2')
    into def2;
  execute def2;

  select prosrc into src_after from pg_proc where oid=o;
  stripped := regexp_replace(src_after, '(?n)^\s*perform public\.pin_gate\([^;]*\);\n', '');
  if stripped <> src_before then raise exception 'ABORT: changed beyond the inserted guard'; end if;
end $mig$;

-- ----------------------------------------------------------------------------
-- STILL OPEN, for Nick to decide rather than for us to change unilaterally:
-- the throttle buys time, it does not fix the 4-digit PIN. Worth doing when
-- there is someone to tell: require 6+ digits at signup for NEW shops (the
-- signup form and create_loop_shop's '^[0-9]{4,8}$' check), and prompt the
-- handful of existing owners to lengthen theirs.
-- ----------------------------------------------------------------------------

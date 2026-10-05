-- ============================================================================
-- CLIENT IMPORT — the wall between trying Loop and switching to it.
--
-- Until this existed the only way into reward_members was join_rewards, on the
-- CUSTOMER-facing card. A barber with 200 clients on Booksy brought across
-- exactly zero of them and had to wait for all 200 to walk in and scan a
-- poster. That is not a drop-off risk, it is the reason a shop never starts.
--
-- ── THE RULE THAT IS NOT NEGOTIABLE: AN IMPORT IS NOT CONSENT ───────────────
-- A barber having someone's number does not mean that person agreed to receive
-- automated marketing texts from a platform they have never heard of. So
-- sms_consent is left NULL on every imported row — never true, not even if the
-- file has a column claiming otherwise.
--
-- What an imported client CAN get: a text from the barber himself, off his own
-- phone, through the win-back run. That is a man texting his own customer.
-- What they must not get: a Loop-sent automated blast, until they opt in on the
-- card like everybody else. When Twilio and A2P 10DLC land, the sending side
-- must filter on sms_consent — this function is where that promise is kept.
--
-- ── LAST VISIT IS THE POINT ─────────────────────────────────────────────────
-- An import that carries only names is an address book. One that carries the
-- last visit date makes "who's due a cut" work on day one, which is the thing
-- a barber actually wants from Loop in week one. Those dates are PRE-LOOP
-- history, so they set last_visit_at but award no points and write no
-- BASE_VISIT rows — the ledger records visits Loop actually saw, and nothing
-- else. A shop's real_visits count staying at zero after an import is correct.
--
-- ── MATCHING ────────────────────────────────────────────────────────────────
-- Phones are matched on the LAST TEN DIGITS, not the string. The first cut
-- compared exactly, and a Booksy export saying "(610) 555-0001" did not match
-- the card's stored "+16105550001" — so the very first import silently doubled
-- the barber's list, and every duplicate would then have been texted twice.
-- Email is matched case-insensitively for the same reason.
--
-- Rows are also deduped against each other inside one file, because an export
-- with the same client twice is one client.
-- ============================================================================

create index if not exists reward_members_phone_last10
  on public.reward_members (client, right(regexp_replace(phone,'[^0-9]','','g'), 10))
  where phone is not null;

-- p_dry_run powers the preview: identical counting, no writes. The page always
-- runs it before the real thing, so a barber sees "184 new, 12 already had,
-- 4 skipped" before anything touches his shop.
create or replace function public.loop_import_members(
  p_client text, p_pin text, p_rows jsonb, p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  s public.reward_settings;
  e jsonb;
  nm text; ph text; em text; d10 text; lv date;
  m public.reward_members;
  added int := 0; merged int := 0; skipped int := 0; n int := 0;
  seen_ph text[] := '{}'; seen_em text[] := '{}';
  notes jsonb := '[]'::jsonb;
  MAXROWS constant int := 2000;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if s.client is null then return jsonb_build_object('ok',false,'error','No shop with that code.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;
  if jsonb_typeof(coalesce(p_rows,'null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok',false,'error','Nothing to import.');
  end if;

  for e in select jsonb_array_elements(p_rows) loop
    n := n + 1;
    exit when n > MAXROWS;

    nm := left(btrim(coalesce(e->>'name','')), 80);
    ph := nullif(regexp_replace(coalesce(e->>'phone',''), '[^0-9+]', '', 'g'), '');
    em := nullif(lower(btrim(coalesce(e->>'email',''))), '');

    -- a number too short to dial is a typo, not a contact
    if ph is not null and length(regexp_replace(ph,'[^0-9]','','g')) < 7 then ph := null; end if;
    if em is not null and em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then em := null; end if;
    d10 := case when ph is null then null else right(regexp_replace(ph,'[^0-9]','','g'), 10) end;

    -- one bad date cell must not sink a 200-row file
    lv := null;
    begin
      if btrim(coalesce(e->>'last_visit','')) <> '' then lv := (e->>'last_visit')::date; end if;
      if lv is not null and (lv > current_date or lv < current_date - 3650) then lv := null; end if;
    exception when others then lv := null; end;

    if ph is null and em is null then
      skipped := skipped + 1;
      if jsonb_array_length(notes) < 20 then
        notes := notes || jsonb_build_object('row',n,'why','no usable phone or email','name',left(nm,40));
      end if;
      continue;
    end if;

    if (d10 is not null and d10 = any(seen_ph)) or (em is not null and em = any(seen_em)) then
      skipped := skipped + 1;
      if jsonb_array_length(notes) < 20 then
        notes := notes || jsonb_build_object('row',n,'why','duplicate inside the file','name',left(nm,40));
      end if;
      continue;
    end if;
    if d10 is not null then seen_ph := seen_ph || d10; end if;
    if em  is not null then seen_em := seen_em || em;  end if;

    m := null;
    if d10 is not null then
      select * into m from public.reward_members
       where client = s.client
         and right(regexp_replace(phone,'[^0-9]','','g'), 10) = d10 limit 1;
    end if;
    if m.id is null and em is not null then
      select * into m from public.reward_members
       where client = s.client and lower(email) = em limit 1;
    end if;

    if m.id is not null then
      merged := merged + 1;
      if not p_dry_run then
        update public.reward_members
           set name  = case when coalesce(name,'') = '' then nm else name end,
               phone = coalesce(phone, ph),
               email = coalesce(email, em),
               -- only ever move a last visit FORWARD: an old spreadsheet must
               -- not make a current regular look lapsed and get chased
               last_visit_at = case
                 when lv is null then last_visit_at
                 when last_visit_at is null or lv::timestamptz > last_visit_at then lv::timestamptz
                 else last_visit_at end
         where id = m.id;
      end if;
    else
      added := added + 1;
      if not p_dry_run then
        insert into public.reward_members
          (client, name, phone, email, code, last_visit_at, points, lifetime, sms_consent)
        values (s.client, nm, ph, em,
                substr(md5(random()::text || clock_timestamp()::text),1,8),
                lv::timestamptz, 0, 0,
                null);   -- an import is NEVER consent. See the header.
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'dry_run',coalesce(p_dry_run,false),
    'added',added,'merged',merged,'skipped',skipped,
    'total',least(n,MAXROWS),'truncated', n > MAXROWS,'notes',notes);
end $$;

revoke execute on function public.loop_import_members(text,text,jsonb,boolean) from public, anon, authenticated;
grant  execute on function public.loop_import_members(text,text,jsonb,boolean) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- VERIFIED against a scratch shop with a deliberately awkward file:
--   · "(610) 555-0001" MERGED with the stored "+16105550001" instead of
--     creating a second Ray — the bug that made this rewrite necessary
--   · his last visit moved forward, and an older row for him later in the
--     file did not drag it back
--   · his existing sms_consent=true was left alone; every NEW row came in null
--   · "1 610 555 0002" was caught as the same person as "610-555-0002"
--   · a 3-digit phone, an unparseable date and a row with neither contact
--     were skipped with reasons, and the rest of the file still imported
--   · no points awarded, no BASE_VISIT rows written
-- ----------------------------------------------------------------------------

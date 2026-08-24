-- ============================================================================
-- LOOP — A TEXTING NUMBER PER SHOP, AND THE RULES ABOUT USING IT
--
-- ── WHAT WAS THERE ─────────────────────────────────────────────────────────
-- /center/ said "when your Twilio number is switched on", which promised the
-- barber something no barber can do. There was no per-shop Twilio: loop_send_sms
-- read twilio_sid / twilio_token / twilio_from out of app_config — one global
-- key set, no client column — so every shop on Loop would have texted from the
-- same number. And it could not text at all: only twilio_sid was ever filled
-- in, so the function returned null and the page said "not switched on yet"
-- with nothing a barber could do about it.
--
-- ── THE TWO TIERS, WHICH IS THE ACTUAL ANSWER ──────────────────────────────
-- Free: the shop's own phone. Already built — automations_due in
-- hq/automations.sql lists who is due, the owner taps, their Messages app opens
-- with the words in it. No number, no cost, no registration, nothing to set up,
-- and it is what most shops should use.
--
-- Paid: Loop carries a number for the shop. The barber taps once and fills in
-- the four things the carriers demand (legal name, EIN, address, contact) —
-- that paperwork is A2P 10DLC and there is no way around it in the US. Nothing
-- else is asked of him. The number is bought and attached from /hq/sms/, so no
-- money moves without a deliberate tap on this side.
--
-- ── THE COMPLIANCE BUG THIS FIXES ──────────────────────────────────────────
-- run_sms_automations texted every lapsed member of every shop and never once
-- looked at reward_members.sms_opt_out_at or sms_consent, both of which have
-- existed the whole time. A customer who replied STOP kept getting win-back
-- texts. It also had no STOP footer and no quiet hours, so it could text a
-- barber's customers at four in the morning from a number they never agreed to
-- hear from. All three are fixed here, and the gate is one function so a future
-- sender cannot forget to call it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Per-shop numbers. Nothing here is a secret: the account SID and token stay in
-- app_config, because they are Loop's, not the shop's. What belongs to the shop
-- is the number it sends from and whether it is allowed to.
-- ----------------------------------------------------------------------------
alter table public.reward_settings
  add column if not exists sms_from      text,        -- +1610… the shop's own number
  add column if not exists sms_state     text not null default 'off',
  add column if not exists sms_biz       jsonb,       -- what the carriers ask for
  add column if not exists sms_asked_at  timestamptz,
  add column if not exists sms_live_at   timestamptz,
  add column if not exists sms_note      text;        -- why it was paused, in plain words

alter table public.reward_settings drop constraint if exists reward_settings_sms_state;
alter table public.reward_settings add constraint reward_settings_sms_state
  check (sms_state in ('off','wanted','requested','live','paused'));

-- One number belongs to one shop. Without this a copy-paste in the admin panel
-- puts two shops on the same number and one shop's STOP silences the other's.
create unique index if not exists reward_settings_sms_from_uniq
  on public.reward_settings(sms_from) where sms_from is not null;

-- ----------------------------------------------------------------------------
-- WHO IS ALLOWED TO ASK
--
-- A number costs money every month whether the shop texts anybody or not, so a
-- shop that has never paid for anything cannot be allowed to summon one by
-- tapping a button. But a barber who wants it is the most qualified lead there
-- is, and refusing him with a locked door loses that.
--
-- So there are two taps, not one. 'wanted' costs nothing and asks nothing: he
-- says he wants texting, it shows up on Loop's side, somebody rings him. Only
-- once he is actually paying does the registration form appear, and only then
-- can a number be attached. The paperwork is never collected from someone who
-- has not agreed to pay for what it is for.
--
-- Every shop in the database is 'trial' today and nothing anywhere moves one
-- off it, so sms_mark_paid exists as well — a gate nothing can open is just a
-- feature that does not work.
-- ----------------------------------------------------------------------------
create or replace function public.sms_paid(p_client text)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select coalesce(plan_status, '') in ('paid','active','pro')
    from public.reward_settings where client = lower(p_client)
$$;

-- ----------------------------------------------------------------------------
-- sms_num — a real number, or nothing.
--
-- _telfmt strips every non-digit and puts a + on the front, so it turns the
-- word "nonsense" into "+" and hands it back as a perfectly good string. Every
-- caller that only checked for null therefore accepted junk: one marked a shop
-- live on a number that can never send, another told a barber his shop had no
-- number when what he had actually typed was letters. One function decides.
-- ----------------------------------------------------------------------------
create or replace function public.sms_num(p text)
returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(public._telfmt(p),''), '[^0-9]', '', 'g')) between 11 and 15
              then public._telfmt(p) end
$$;

-- ----------------------------------------------------------------------------
-- sms_gate — may this shop text this person, right now?
--
-- One function, because the answer has four parts and a sender that remembers
-- three of them is the one that gets a shop's number blocked. Returns null when
-- it is fine to send, or the reason not to.
-- ----------------------------------------------------------------------------
create or replace function public.sms_gate(p_client text, p_code text)
returns text language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; m public.reward_members; h int;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return 'no such shop'; end if;
  if s.sms_state <> 'live' or s.sms_from is null then return 'shop has no number'; end if;

  select * into m from public.reward_members where client = s.client and code = p_code;
  if not found then return 'no such member'; end if;
  if public.sms_num(m.phone) is null then return 'no phone'; end if;

  -- A reply of STOP is the end of the conversation, whatever else is true.
  if m.sms_opt_out_at is not null then return 'opted out'; end if;
  -- Joining the rewards card is the consent; a row that predates the column is
  -- treated as consenting, because it agreed to the same terms at the door.
  if m.sms_consent = false then return 'no consent'; end if;

  -- Nobody wants a haircut advert at four in the morning, and a carrier that
  -- sees one has an easy reason to block the number. 9am-8pm, shop's own clock.
  h := extract(hour from (now() at time zone coalesce(nullif(s.book_tz,''), 'America/New_York')));
  if h < 9 or h >= 20 then return 'quiet hours'; end if;

  return null;
end $$;

-- ----------------------------------------------------------------------------
-- loop_send_sms — now sends from the shop's own number.
--
-- The two-argument form is kept because n8n calls it and a signature change
-- would break a workflow living outside this repository. It falls back to the
-- global number, which is what every existing caller already assumed.
-- ----------------------------------------------------------------------------
-- The three-argument version has a default, so a two-argument call still
-- resolves to it — but only once the old two-argument function is gone. Left in
-- place, loop_send_sms(a,b) is ambiguous and every existing caller fails with
-- "function is not unique", which is a live outage dressed up as a new feature.
drop function if exists public.loop_send_sms(text, text);

create or replace function public.loop_send_sms(p_to text, p_body text, p_client text default null)
returns bigint language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare sid text; tok text; frm text; auth text; req bigint; dest text;
begin
  select v into sid from public.app_config where k='twilio_sid';
  select v into tok from public.app_config where k='twilio_token';

  if p_client is not null then
    select sms_from into frm from public.reward_settings
     where client = lower(p_client) and sms_state = 'live';
  end if;
  if frm is null then select v into frm from public.app_config where k='twilio_from'; end if;

  if sid is null or tok is null or frm is null then return null; end if;
  dest := public.sms_num(p_to);
  if dest is null then return null; end if;

  auth := replace(encode(convert_to(sid||':'||tok,'UTF8'),'base64'), E'\n','');
  select net.http_post(
    url := 'https://api.twilio.com/2010-04-01/Accounts/'||sid||'/Messages.json',
    params := jsonb_build_object('To', dest, 'From', frm, 'Body', p_body),
    headers := jsonb_build_object(
      'Authorization','Basic '||auth,
      'Content-Type','application/x-www-form-urlencoded')
  ) into req;
  return req;
end $$;

-- ----------------------------------------------------------------------------
-- run_sms_automations — the win-back run, with the rules applied.
--
-- Was: every shop, from one number, ignoring opt-outs, at any hour, with no way
-- for a customer to stop it. Now: only shops that have their own number, only
-- people who may be texted, only during the shop's own daylight, and every
-- message carries the line that makes STOP work.
-- ----------------------------------------------------------------------------
create or replace function public.run_sms_automations()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare r record; s public.reward_settings; msg text; sent int := 0; req bigint; days int;
begin
  if not exists (select 1 from public.app_config where k='twilio_token') then return 0; end if;

  for s in select * from public.reward_settings where sms_state = 'live' and sms_from is not null loop
    if coalesce((s.automations->'winback'->>'on')::boolean, true) = false then continue; end if;
    days := greatest(7, coalesce((s.automations->'winback'->>'days')::int, 31));

    for r in
      select m.name, m.phone, m.code from public.reward_members m
       where m.client = s.client
         and m.last_visit_at is not null
         and m.last_visit_at <  now() - make_interval(days => days)
         and m.last_visit_at >= now() - interval '90 days'
         and public.sms_gate(s.client, m.code) is null
         and not exists (
           select 1 from public.automation_log al
            where al.client = s.client and al.code = m.code and al.kind = 'winback_sms'
              and al.at > now() - interval '45 days')
       limit 200
    loop
      msg := 'Hey '||coalesce(nullif(split_part(coalesce(r.name,''),' ',1),''),'there')
        ||'! We miss you at '||coalesce(nullif(s.biz_name,''), initcap(s.client))
        ||'. Come back this week 💈'||E'\nReply STOP to opt out.';
      req := public.loop_send_sms(r.phone, msg, s.client);
      if req is not null then
        insert into public.automation_log(client, code, kind, at) values (s.client, r.code, 'winback_sms', now());
        sent := sent + 1;
      end if;
    end loop;
  end loop;
  return sent;
end $$;

-- The test text goes out on the shop's own number once it has one — testing a
-- number the customers will never see proves nothing — and says which of the
-- three reasons it could not send, rather than one message for all of them.
create or replace function public.send_test_sms(p_client text, p_pin text, p_to text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; req bigint; biz text;
begin
  select * into s from public.reward_settings where client=lower(p_client);
  if not found then return jsonb_build_object('ok',false,'error','Shop not found.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'')<>coalesce(p_pin,'') then return jsonb_build_object('ok',false,'error','Wrong PIN.'); end if;
  if public.sms_num(p_to) is null then return jsonb_build_object('ok',false,'error','Enter a valid phone number.'); end if;
  biz := coalesce(nullif(s.biz_name,''), initcap(s.client));
  req := public.loop_send_sms(p_to, 'Test from '||biz||' on Loop ✅ Your texting is switched on.', s.client);
  if req is null then
    return jsonb_build_object('ok', false, 'error',
      case when s.sms_state = 'live' then 'Texting is switched on but the number could not send. Tell Loop.'
           when s.sms_state = 'requested' then 'Your number is still being set up.'
           else 'This shop has no texting number yet.' end);
  end if;
  return jsonb_build_object('ok',true,'sent_to',public.sms_num(p_to),'from',s.sms_from);
end $$;

-- ----------------------------------------------------------------------------
-- What the shop sees and does. Two calls: ask for a number, and check on it.
-- ----------------------------------------------------------------------------
create or replace function public.sms_status(p_client text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; reach int; quiet int;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'Shop not found.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') <> coalesce(p_pin,'') then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;

  -- How many people this would actually reach, so the panel can say something
  -- true instead of "texting is available".
  select count(*) into reach from public.reward_members m
   where m.client = s.client and public.sms_num(m.phone) is not null
     and m.sms_opt_out_at is null and coalesce(m.sms_consent, true);
  select count(*) into quiet from public.reward_members m
   where m.client = s.client and m.sms_opt_out_at is not null;

  return jsonb_build_object('ok', true,
    'paid',      public.sms_paid(s.client),
    'state',     s.sms_state,
    'number',    s.sms_from,
    'asked_at',  s.sms_asked_at,
    'live_at',   s.sms_live_at,
    'note',      s.sms_note,
    'reachable', reach,
    'opted_out', quiet);
end $$;

create or replace function public.sms_interest(p_client text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'Shop not found.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') <> coalesce(p_pin,'') then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  -- Never walks a shop backwards: one that is already registered or live has
  -- said something stronger than "interested".
  if s.sms_state <> 'off' then
    return jsonb_build_object('ok', true, 'state', s.sms_state);
  end if;
  update public.reward_settings
     set sms_state = 'wanted', sms_asked_at = coalesce(sms_asked_at, now())
   where client = s.client;
  return jsonb_build_object('ok', true, 'state', 'wanted');
end $$;

create or replace function public.sms_request(p_client text, p_pin text, p_biz jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; v_legal text; v_ein text; v_addr text; v_who text; v_email text;
begin
  select * into s from public.reward_settings where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'Shop not found.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') <> coalesce(p_pin,'') then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN.');
  end if;
  if s.sms_state = 'live' then
    return jsonb_build_object('ok', false, 'error', 'This shop already has a number.');
  end if;
  if not public.sms_paid(s.client) then
    return jsonb_build_object('ok', false, 'error', 'A number of your own comes with the paid plan.');
  end if;

  v_legal := left(btrim(coalesce(p_biz->>'legal','')), 120);
  v_ein   := left(regexp_replace(coalesce(p_biz->>'ein',''), '[^0-9]', '', 'g'), 9);
  v_addr  := left(btrim(coalesce(p_biz->>'address','')), 200);
  v_who   := left(btrim(coalesce(p_biz->>'contact','')), 80);
  v_email := lower(left(btrim(coalesce(p_biz->>'email','')), 120));

  -- Each of these is a field the carrier registration will reject without, so
  -- catching it here saves a rejection two weeks later that nobody can explain.
  if v_legal = '' then return jsonb_build_object('ok', false, 'error', 'The registered business name is required.'); end if;
  if length(v_ein) <> 9 then return jsonb_build_object('ok', false, 'error', 'The EIN needs to be nine digits.'); end if;
  if v_addr = ''  then return jsonb_build_object('ok', false, 'error', 'The business address is required.'); end if;
  if v_who = ''   then return jsonb_build_object('ok', false, 'error', 'A contact name is required.'); end if;
  if position('@' in v_email) < 2 then return jsonb_build_object('ok', false, 'error', 'A contact email is required.'); end if;

  update public.reward_settings set
    sms_state = 'requested',
    sms_asked_at = coalesce(sms_asked_at, now()),
    sms_biz = jsonb_build_object('legal', v_legal, 'ein', v_ein, 'address', v_addr,
                                 'contact', v_who, 'email', v_email)
   where client = s.client;

  return jsonb_build_object('ok', true, 'state', 'requested');
end $$;

-- ----------------------------------------------------------------------------
-- The Loop side, behind the admin key — same posture as the CRM and the PIN
-- queue: the key lives in memory on the page and nothing here is reachable
-- without it. Buying the number itself happens in Twilio, deliberately: pg_net
-- posts and never sees the reply, so a "buy" from in here could not tell you
-- which number it had bought.
-- ----------------------------------------------------------------------------
create or replace function public.sms_queue(p_key text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  return jsonb_build_object('ok', true, 'shops', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.rank, x.asked_at nulls last, x.biz_name)
      from (
        select s.client, s.biz_name, s.sms_state, s.sms_from, s.sms_biz,
               s.sms_asked_at as asked_at, s.sms_live_at as live_at, s.sms_note,
               public.sms_paid(s.client) as paid,
               case s.sms_state when 'requested' then 0 when 'wanted' then 1
                                when 'paused' then 2 when 'live' then 3 else 4 end as rank,
               (select count(*) from public.reward_members m
                 where m.client = s.client and public.sms_num(m.phone) is not null
                   and m.sms_opt_out_at is null and coalesce(m.sms_consent, true)) as reachable
          from public.reward_settings s
         where s.sms_state <> 'off'
      ) x), '[]'::jsonb));
end $$;

create or replace function public.sms_attach(p_key text, p_client text, p_from text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_from text; v_c text := lower(btrim(coalesce(p_client,'')));
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_from := public.sms_num(p_from);
  if v_from is null then
    return jsonb_build_object('ok', false, 'error', 'That is not a phone number — include the country code, like +16105551234.');
  end if;
  if exists (select 1 from public.reward_settings where sms_from = v_from and client <> v_c) then
    return jsonb_build_object('ok', false, 'error', 'Another shop is already on that number.');
  end if;
  -- The last stop before a monthly bill starts against a shop that is not
  -- paying one. Everything above this is a form; this is the money.
  if not public.sms_paid(v_c) then
    return jsonb_build_object('ok', false, 'error', 'That shop is not on a paid plan — mark it paying first.');
  end if;
  update public.reward_settings set
    sms_from = v_from, sms_state = 'live',
    sms_live_at = coalesce(sms_live_at, now()),
    sms_note = nullif(btrim(coalesce(p_note,'')), '')
   where client = v_c;
  if not found then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  return jsonb_build_object('ok', true, 'number', v_from);
end $$;

create or replace function public.sms_mark_paid(p_key text, p_client text, p_on boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_st text;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_st := case when coalesce(p_on, true) then 'paid' else 'trial' end;
  update public.reward_settings set plan_status = v_st where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  return jsonb_build_object('ok', true, 'plan_status', v_st, 'paid', public.sms_paid(p_client));
end $$;

create or replace function public.sms_set_state(p_key text, p_client text, p_state text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_st text := lower(btrim(coalesce(p_state,'')));
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  if v_st not in ('off','wanted','requested','live','paused') then
    return jsonb_build_object('ok', false, 'error', 'Unknown state.');
  end if;
  if v_st = 'live' and not exists (
       select 1 from public.reward_settings where client = lower(p_client) and sms_from is not null) then
    return jsonb_build_object('ok', false, 'error', 'Attach a number before making it live.');
  end if;
  update public.reward_settings set
    sms_state = v_st,
    sms_note  = case when p_note is null then sms_note else nullif(btrim(p_note),'') end,
    -- Turning it off releases the number, so the next shop can be given it and
    -- a paused shop cannot quietly keep sending from one it no longer pays for.
    sms_from  = case when v_st = 'off' then null else sms_from end
   where client = lower(p_client);
  if not found then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  return jsonb_build_object('ok', true, 'state', v_st);
end $$;

-- A customer's STOP has to land somewhere. Twilio handles the carrier-level
-- opt-out on its own, but Loop has to know too, or every list in the product
-- goes on counting someone who has left.
create or replace function public.sms_opt_out(p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_from text := public.sms_num(p_from); n int := 0;
begin
  if v_from is null then return jsonb_build_object('ok', false); end if;
  update public.reward_members m set sms_opt_out_at = now(), sms_consent = false
   where public.sms_num(m.phone) = v_from
     and m.sms_opt_out_at is null
     and (p_to is null or m.client in (
          select client from public.reward_settings where sms_from = public.sms_num(p_to)));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'stopped', n);
end $$;

revoke execute on function public.sms_paid(text)                             from public, anon, authenticated;
revoke execute on function public.sms_interest(text,text)                    from public, anon, authenticated;
revoke execute on function public.sms_mark_paid(text,text,boolean)           from public, anon, authenticated;
revoke execute on function public.sms_gate(text,text)                        from public, anon, authenticated;
revoke execute on function public.loop_send_sms(text,text,text)              from public, anon, authenticated;
revoke execute on function public.run_sms_automations()                      from public, anon, authenticated;
revoke execute on function public.sms_opt_out(text,text)                     from public, anon, authenticated;
revoke execute on function public.sms_queue(text)                            from public, anon, authenticated;
revoke execute on function public.sms_attach(text,text,text,text)            from public, anon, authenticated;
revoke execute on function public.sms_set_state(text,text,text,text)         from public, anon, authenticated;
revoke execute on function public.sms_status(text,text)                      from public, anon, authenticated;
revoke execute on function public.sms_request(text,text,jsonb)               from public, anon, authenticated;

-- The shop's own two calls are PIN-gated inside; the admin's are key-gated.
grant execute on function public.sms_status(text,text)               to anon, authenticated;
grant execute on function public.sms_request(text,text,jsonb)        to anon, authenticated;
grant execute on function public.sms_interest(text,text)             to anon, authenticated;
grant execute on function public.sms_mark_paid(text,text,boolean)    to anon, authenticated;
grant execute on function public.sms_queue(text)                     to anon, authenticated;
grant execute on function public.sms_attach(text,text,text,text)     to anon, authenticated;
grant execute on function public.sms_set_state(text,text,text,text)  to anon, authenticated;

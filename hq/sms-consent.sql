-- ============================================================================
-- SMS CONSENT, RECORDED THE WAY A CARRIER ASKS FOR IT
-- ----------------------------------------------------------------------------
-- Backs /kit/leadform/ — the generator that builds A2P-10DLC-compliant lead
-- forms for clients.
--
-- A ticked box is not proof of consent. What Twilio and the carriers ask for
-- during campaign vetting — and what a TCPA complaint turns on — is evidence of
-- WHAT a person was shown at the moment they agreed: the exact words, the page,
-- and when. A boolean column cannot answer that a year later, so the disclosure
-- text is stored verbatim beside it.
--
-- Two deliberate choices:
--
-- Consent is stored even when REFUSED. A record showing this person declined is
-- what stops them being added to a blast by hand later, and it is the
-- difference between "we never texted them" and "we cannot prove we didn't".
--
-- Nothing here ever deletes. Withdrawal is a new row with consented=false, so
-- the history stays intact — the moment you delete the trail, the trail is
-- worth nothing.
--
-- Idempotent: safe to run whole, repeatedly, in Supabase → SQL Editor.
-- Requires client_leads (hq/clients-crm.sql).
-- ============================================================================

create table if not exists public.sms_consents(
  id           uuid primary key default gen_random_uuid(),
  client       text not null,                  -- the shop slug, same key as client_leads
  name         text,
  phone        text not null,
  email        text,
  consented    boolean not null,
  consent_text text not null,                  -- the exact words shown, verbatim
  program      text,                           -- "Ray's Barbershop appointment reminders"
  frequency    text,                           -- "up to 4 msgs/month" or "varies"
  source_url   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists sms_consents_client_idx on public.sms_consents(client, created_at desc);
create index if not exists sms_consents_phone_idx  on public.sms_consents(client, phone);
alter table public.sms_consents enable row level security;
revoke all on public.sms_consents from anon;

do $$ begin
  execute 'drop policy if exists "admin reads sms consents" on public.sms_consents';
  execute 'create policy "admin reads sms consents" on public.sms_consents for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
end $$;

-- One call from a lead form: the lead lands in the CRM and the consent record
-- is written in the same transaction. Two calls could half-succeed, and a lead
-- with no consent row is exactly the row that gets texted by mistake.
create or replace function public.lead_capture_with_consent(
  p_client text, p_name text, p_phone text, p_email text default null,
  p_service text default null, p_message text default null,
  p_sms_consent boolean default false, p_consent_text text default null,
  p_program text default null, p_frequency text default null,
  p_source_url text default null, p_user_agent text default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_client text; v_phone text; v_digits text; v_recent int;
begin
  v_client := lower(btrim(coalesce(p_client,'')));
  v_phone  := btrim(coalesce(p_phone,''));
  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  if v_client = '' then return json_build_object('ok',false,'error','Missing business.'); end if;
  if length(btrim(coalesce(p_name,''))) < 2 then
    return json_build_object('ok',false,'error','Please enter your name.'); end if;
  if length(v_digits) < 10 then
    return json_build_object('ok',false,'error','Enter a mobile number we can reach you on.'); end if;

  -- Consent claimed with no record of what was shown is worse than no consent:
  -- an unprovable claim in a system that exists only to prove things.
  if coalesce(p_sms_consent,false) and length(btrim(coalesce(p_consent_text,''))) < 40 then
    return json_build_object('ok',false,'error','Consent could not be recorded. Please refresh and try again.');
  end if;

  -- A form left open in a tab and resubmitted is not a second lead.
  select count(*) into v_recent from public.client_leads
   where client = v_client
     and regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits
     and created_at > now() - interval '2 minutes';
  if v_recent > 0 then return json_build_object('ok',true,'duplicate',true); end if;

  insert into public.client_leads(client, kind, name, phone, email, service, message)
    values (v_client, 'lead', btrim(p_name), v_phone, nullif(btrim(coalesce(p_email,'')),''),
            nullif(btrim(coalesce(p_service,'')),''),
            coalesce(nullif(btrim(coalesce(p_message,'')),''),'') ||
            case when coalesce(p_sms_consent,false)
                 then E'\n[SMS consent given ' || to_char(now(),'YYYY-MM-DD HH24:MI') || ' UTC]'
                 else E'\n[No SMS consent — do not text marketing]' end);

  insert into public.sms_consents(client, name, phone, email, consented, consent_text, program, frequency, source_url, user_agent)
    values (v_client, btrim(p_name), v_phone, nullif(btrim(coalesce(p_email,'')),''),
            coalesce(p_sms_consent,false),
            coalesce(nullif(btrim(coalesce(p_consent_text,'')),''),'(no SMS consent requested on this form)'),
            nullif(btrim(coalesce(p_program,'')),''), nullif(btrim(coalesce(p_frequency,'')),''),
            left(coalesce(p_source_url,''), 400), left(coalesce(p_user_agent,''), 300));

  return json_build_object('ok', true, 'sms_consent', coalesce(p_sms_consent,false));
end $$;

-- Withdrawal. STOP replies are handled by the carrier and by Twilio's own
-- opt-out list; this is for the ones that arrive as "take me off your texts" in
-- person, by email, or on a review — still a binding withdrawal, and still has
-- to be recorded somewhere.
create or replace function public.sms_consent_withdraw(p_client text, p_phone text, p_how text default 'asked in person')
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  insert into public.sms_consents(client, phone, consented, consent_text, program)
    values (lower(btrim(coalesce(p_client,''))), btrim(coalesce(p_phone,'')), false,
            'CONSENT WITHDRAWN — ' || coalesce(nullif(btrim(coalesce(p_how,'')),''),'no method given'), 'withdrawal');
  return json_build_object('ok', true);
end $$;

-- "Is this number allowed to be texted for this shop?" — the newest row wins.
create or replace function public.sms_consent_check(p_client text, p_phone text)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare r public.sms_consents;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  select * into r from public.sms_consents
   where client = lower(btrim(coalesce(p_client,'')))
     and regexp_replace(phone,'\D','','g') = regexp_replace(coalesce(p_phone,''),'\D','','g')
   order by created_at desc limit 1;
  if not found then return json_build_object('ok',true,'allowed',false,'reason','No consent record for that number.'); end if;
  return json_build_object('ok',true,'allowed',r.consented,'when',r.created_at,'text',r.consent_text,'program',r.program);
end $$;

revoke execute on function public.lead_capture_with_consent(text,text,text,text,text,text,boolean,text,text,text,text,text) from public;
grant  execute on function public.lead_capture_with_consent(text,text,text,text,text,text,boolean,text,text,text,text,text) to anon, authenticated;
revoke execute on function public.sms_consent_withdraw(text,text,text) from public, anon;
revoke execute on function public.sms_consent_check(text,text)         from public, anon;
grant  execute on function public.sms_consent_withdraw(text,text,text) to authenticated;
grant  execute on function public.sms_consent_check(text,text)         to authenticated;

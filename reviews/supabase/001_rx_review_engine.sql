-- Review Engine ($97/mo, tbsol.net/reviews/) — the delivery behind the offer.
--
-- A job gets marked done (receptionist job, Housecall Pro / Jobber webhook, a "Job done" tap in the
-- owner app or HQ, or a pasted list). Two hours later the customer gets one text with the shop's
-- Google review link. If they never tap it, one reminder on day 3. Then it stops. Every link goes
-- through /r/<token> so taps are counted. STOP is honoured everywhere, forever.
--
-- Tables   rx_review_requests, rx_review_snapshots (+ view rx_review_weekly)
-- Columns  rx_businesses.google_place_id, review_engine, review_hook_token (review_url already exists)
-- Sender   edge fn rx-review-engine on pg_cron every 10 min (send), daily (snapshot), Friday (owner digest)
-- Links    edge fn rx-review-io: GET /r/<token> redirect, POST /sms Twilio inbound (STOP), POST /hook/<token>
--
-- Replaces the old rx-review hourly job for every shop with review_engine = true (the trigger below
-- enqueues the job; rx_review_mark still writes the rx_review_asks row so the HQ Agents card and the
-- Coach keep reading the truth, and so rx-review can never double-text a job even if re-scheduled).
--
-- Run after receptionist/supabase/007 and hq/supabase/013. Idempotent. Apply with the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------- columns on the shop ----------
alter table public.rx_businesses add column if not exists review_url text;
alter table public.rx_businesses add column if not exists google_place_id text;
alter table public.rx_businesses add column if not exists review_engine boolean not null default false;
alter table public.rx_businesses add column if not exists review_hook_token text unique default encode(gen_random_bytes(12), 'hex');
update public.rx_businesses set review_hook_token = encode(gen_random_bytes(12), 'hex') where review_hook_token is null;
-- Shops that already had a review link were already getting review texts from rx-review; keep them on.
update public.rx_businesses set review_engine = true where review_url is not null and review_engine = false;

-- ---------- helpers ----------
create or replace function public.rx_phone_e164(p text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when length(d) = 10 then '+1' || d
              when length(d) = 11 and left(d, 1) = '1' then '+' || d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

-- The one place the review link is decided: the pasted link wins, else build it from the Place ID.
create or replace function public.rx_review_link(p_url text, p_place_id text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(nullif(trim(p_url), ''),
    case when nullif(trim(p_place_id), '') is not null
         then 'https://search.google.com/local/writereview?placeid=' || trim(p_place_id) end)
$$;

-- Consent as the receptionist records it: the LATEST rx_sms_optins row for the number decides.
-- true = said yes (web form or on the call), false = said STOP, null = we have no record.
create or replace function public.rx_sms_allowed(p_phone text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select o.service_texts from public.rx_sms_optins o
  where rx_phone_e164(o.phone) = rx_phone_e164(p_phone)
  order by o.created_at desc limit 1
$$;
revoke all on function public.rx_sms_allowed(text) from public, anon;
grant execute on function public.rx_sms_allowed(text) to authenticated, service_role;

-- ---------- the requests ----------
create table if not exists public.rx_review_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.rx_businesses(id) on delete cascade,
  job_id        uuid references public.rx_jobs(id) on delete set null,
  customer_name text,
  phone         text not null,                        -- E.164
  source        text not null default 'manual' check (source in ('rx_job','manual','import','webhook')),
  consent       text not null default 'none' check (consent in ('optin','attested','none')),
  status        text not null default 'queued' check (status in ('queued','sent','clicked','reviewed','stopped','failed','skipped')),
  touches       int  not null default 0,              -- texts actually sent (max 2)
  token         text not null unique default encode(gen_random_bytes(6), 'hex'),
  next_at       timestamptz,                          -- when the sender should look at it next; null = never
  sent_at       timestamptz,                          -- first text
  last_touch_at timestamptz,                          -- latest text
  clicked_at    timestamptz,
  external_ref  text,                                 -- HCP / Jobber job id when it came in by webhook
  note          text,                                 -- why skipped / failed / stopped, in plain words
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists rx_review_requests_job_uq on public.rx_review_requests(job_id) where job_id is not null;
create index if not exists rx_review_requests_due_idx on public.rx_review_requests(next_at) where next_at is not null;
create index if not exists rx_review_requests_biz_idx on public.rx_review_requests(business_id, created_at desc);
create index if not exists rx_review_requests_phone_idx on public.rx_review_requests(phone, created_at desc);
drop trigger if exists rx_review_requests_touch on public.rx_review_requests;
create trigger rx_review_requests_touch before update on public.rx_review_requests for each row execute function public.rx_touch();

-- Google's own count and rating, once a day per shop (needs a Place ID + GOOGLE_PLACES_KEY).
create table if not exists public.rx_review_snapshots (
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  day         date not null default (now() at time zone 'America/New_York')::date,
  rating      numeric(3,2),
  count       int,
  primary key (business_id, day)
);

-- RLS: owners read their own, HQ admins read all, anon nothing. All writes go through RPCs / service role.
alter table public.rx_review_requests enable row level security;
alter table public.rx_review_snapshots enable row level security;
drop policy if exists rx_review_requests_owner_read on public.rx_review_requests;
create policy rx_review_requests_owner_read on public.rx_review_requests for select to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = (select auth.uid())));
drop policy if exists rx_review_requests_admin_read on public.rx_review_requests;
create policy rx_review_requests_admin_read on public.rx_review_requests for select to authenticated
  using (is_hq_admin());
drop policy if exists rx_review_snapshots_owner_read on public.rx_review_snapshots;
create policy rx_review_snapshots_owner_read on public.rx_review_snapshots for select to authenticated
  using (business_id in (select business_id from public.rx_business_users where user_id = (select auth.uid())));
drop policy if exists rx_review_snapshots_admin_read on public.rx_review_snapshots;
create policy rx_review_snapshots_admin_read on public.rx_review_snapshots for select to authenticated
  using (is_hq_admin());
revoke all on table public.rx_review_requests, public.rx_review_snapshots from anon;
revoke insert, update, delete on table public.rx_review_requests, public.rx_review_snapshots from authenticated;

-- Per-business weekly count. security_invoker so the table policies above apply to whoever reads it.
create or replace view public.rx_review_weekly with (security_invoker = true) as
  select business_id,
         date_trunc('week', coalesce(sent_at, created_at))::date as week,
         count(*) filter (where sent_at is not null)             as sent,
         count(*) filter (where clicked_at is not null)          as clicked,
         count(*) filter (where status = 'reviewed')             as reviewed,
         count(*) filter (where status = 'stopped')              as stopped,
         count(*) filter (where status = 'queued')               as queued
  from public.rx_review_requests
  group by business_id, date_trunc('week', coalesce(sent_at, created_at));
revoke all on public.rx_review_weekly from anon, public;
grant select on public.rx_review_weekly to authenticated, service_role;

-- ---------- enqueue: the one door every trigger source goes through ----------
-- Returns {ok, id, status, dup, error}. Never texts; the sender does that later.
create or replace function public.rx_review_enqueue(p_business uuid, p_name text, p_phone text, p_source text,
  p_consent text default 'none', p_job uuid default null, p_delay interval default interval '2 hours', p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_phone text := rx_phone_e164(p_phone); v_allowed boolean; v_consent text := coalesce(p_consent, 'none');
        v_on boolean; v_existing public.rx_review_requests; v_id uuid; v_status text := 'queued'; v_note text;
begin
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'Need a 10-digit US mobile number.'); end if;
  select review_engine into v_on from rx_businesses where id = p_business;
  if v_on is null then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  if not v_on then return jsonb_build_object('ok', false, 'error', 'Review Engine is not switched on for this shop yet.'); end if;
  if p_job is not null and exists (select 1 from rx_review_requests where job_id = p_job) then
    return jsonb_build_object('ok', true, 'dup', true, 'id', (select id from rx_review_requests where job_id = p_job));
  end if;
  -- same customer, same shop, inside 30 days: one ask is plenty
  select * into v_existing from rx_review_requests
   where business_id = p_business and phone = v_phone and created_at > now() - interval '30 days' and status <> 'failed'
   order by created_at desc limit 1;
  if found then return jsonb_build_object('ok', true, 'dup', true, 'id', v_existing.id, 'status', v_existing.status); end if;

  v_allowed := rx_sms_allowed(v_phone);
  if v_allowed is true then v_consent := 'optin'; end if;
  if v_allowed is false then v_status := 'stopped'; v_note := 'This number texted STOP. It will never be asked.'; end if;

  insert into rx_review_requests (business_id, job_id, customer_name, phone, source, consent, status, note, external_ref, next_at)
  values (p_business, p_job, nullif(trim(coalesce(p_name, '')), ''), v_phone, p_source, v_consent, v_status, v_note, p_ref,
          case when v_status = 'queued' then now() + coalesce(p_delay, interval '2 hours') end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end $$;
revoke all on function public.rx_review_enqueue(uuid, text, text, text, text, uuid, interval, text) from public, anon, authenticated;
grant execute on function public.rx_review_enqueue(uuid, text, text, text, text, uuid, interval, text) to service_role;

-- (a) receptionist job marked done — HQ says 'done', the owner app says 'completed'; both count.
create or replace function public.rx_jobs_review_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('done', 'completed') and old.status is distinct from new.status
     and new.customer_phone is not null
     and exists (select 1 from rx_businesses where id = new.business_id and review_engine) then
    perform rx_review_enqueue(new.business_id, new.customer_name, new.customer_phone, 'rx_job',
      case when coalesce(new.notes, '') ilike '%[sms consent: yes]%' then 'attested' else 'none' end, new.id);
  end if;
  return new;
end $$;
revoke all on function public.rx_jobs_review_trigger() from public, anon, authenticated;
drop trigger if exists rx_jobs_review on public.rx_jobs;
create trigger rx_jobs_review after update of status on public.rx_jobs for each row execute function public.rx_jobs_review_trigger();

-- ---------- what the sender (edge fn rx-review-engine, service role) calls ----------
-- Everything due right now, with the gate already evaluated so the function only has to act on it.
create or replace function public.rx_review_due(p_limit int default 50)
returns table (id uuid, business_id uuid, business text, timezone text, customer_name text, phone text, token text,
               touches int, link text, allowed boolean, opted_out boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.business_id, b.name, b.timezone, r.customer_name, r.phone, r.token, r.touches,
         rx_review_link(b.review_url, b.google_place_id) as link,
         (rx_sms_allowed(r.phone) is true or (rx_sms_allowed(r.phone) is null and r.consent in ('optin', 'attested'))) as allowed,
         (rx_sms_allowed(r.phone) is false) as opted_out
  from rx_review_requests r join rx_businesses b on b.id = r.business_id
  where r.status in ('queued', 'sent') and r.touches < 2 and r.clicked_at is null
    and r.next_at is not null and r.next_at <= now() and b.review_engine and b.active
  order by r.next_at asc limit greatest(1, least(p_limit, 200))
$$;

-- sent | defer (try again at p_next) | failed | skipped | stopped
create or replace function public.rx_review_mark(p_id uuid, p_status text, p_note text default null, p_next timestamptz default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rx_review_requests;
begin
  select * into r from rx_review_requests where id = p_id for update;
  if not found then return; end if;
  if p_status = 'sent' then
    update rx_review_requests set status = 'sent', touches = r.touches + 1, sent_at = coalesce(r.sent_at, now()), last_touch_at = now(),
      next_at = case when r.touches + 1 >= 2 then null else now() + interval '3 days' end, note = null
     where id = p_id;
    -- keep the receptionist's one-row-per-job ledger true (HQ Agents card, Coach, and rx-review's own dedupe)
    if r.job_id is not null and r.touches = 0 and to_regclass('public.rx_review_asks') is not null then
      insert into rx_review_asks (job_id, business_id, phone, status, reason) values (r.job_id, r.business_id, r.phone, 'sent', null)
      on conflict (job_id) do nothing;
    end if;
  elsif p_status = 'defer' then
    update rx_review_requests set next_at = coalesce(p_next, now() + interval '1 day'), note = p_note where id = p_id;
  elsif p_status in ('failed', 'skipped', 'stopped') then
    update rx_review_requests set status = p_status, next_at = null, note = p_note where id = p_id;
    if r.job_id is not null and r.touches = 0 and to_regclass('public.rx_review_asks') is not null then
      insert into rx_review_asks (job_id, business_id, phone, status, reason)
      values (r.job_id, r.business_id, r.phone, case when p_status = 'failed' then 'failed' else 'skipped' end, left(p_note, 200))
      on conflict (job_id) do nothing;
    end if;
  end if;
end $$;

-- A tap on /r/<token>. Returns where to send them (always, even after STOP: the link is theirs to use).
create or replace function public.rx_review_click(p_token text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_link text;
begin
  update rx_review_requests r set clicked_at = coalesce(r.clicked_at, now()), next_at = null,
    status = case when r.status in ('queued', 'sent') then 'clicked' else r.status end
   from rx_businesses b where r.token = p_token and b.id = r.business_id
   returning rx_review_link(b.review_url, b.google_place_id) into v_link;
  return v_link;
end $$;

-- Inbound text to the shop's number. STOP / START / HELP are honoured in the same ledger the
-- receptionist reads (rx_sms_optins); anything else is a reply we hand to the owner.
create or replace function public.rx_review_inbound(p_from text, p_body text, p_source text default 'twilio') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_phone text := rx_phone_e164(p_from); v_word text := upper(regexp_replace(btrim(coalesce(p_body, '')), '\s+', ' ', 'g'));
        v_action text := 'reply'; v_reply text; r record;
begin
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'bad phone'); end if;
  select rr.business_id, rr.customer_name, b.name as business, b.slug, b.owner_phone into r
    from rx_review_requests rr join rx_businesses b on b.id = rr.business_id
   where rr.phone = v_phone order by rr.created_at desc limit 1;
  if v_word in ('STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT', 'OPT OUT') then
    v_action := 'opted_out';
    insert into rx_sms_optins (phone, name, business_slug, service_texts, promo_texts, source)
    values (v_phone, r.customer_name, coalesce(r.slug, 'unknown'), false, false, 'stop:' || p_source);
    update rx_review_requests set status = 'stopped', next_at = null, note = 'Texted STOP' where phone = v_phone and status in ('queued', 'sent');
    v_reply := 'You are unsubscribed and will get no more texts from ' || coalesce(r.business, 'us') || '. Reply START to rejoin.';
  elsif v_word in ('START', 'UNSTOP', 'YES', 'OPTIN', 'OPT IN') then
    v_action := 'opted_in';
    insert into rx_sms_optins (phone, name, business_slug, service_texts, promo_texts, source)
    values (v_phone, r.customer_name, coalesce(r.slug, 'unknown'), true, false, 'start:' || p_source);
    v_reply := 'You are back in. Reply STOP any time to cancel.';
  elsif v_word in ('HELP', 'INFO') then
    v_action := 'help';
    v_reply := coalesce(r.business, 'TB Solutions') || ': appointment and review texts. Msg & data rates may apply. Reply STOP to cancel. Help: tbsol.net/sms-terms/';
  end if;
  return jsonb_build_object('ok', true, 'action', v_action, 'reply', v_reply, 'business', r.business,
    'customer', r.customer_name, 'owner_phone', case when v_action = 'reply' then r.owner_phone end);
end $$;

-- Housecall Pro / Jobber / anything that can POST json: /hook/<review_hook_token>
create or replace function public.rx_review_hook(p_token text, p_name text, p_phone text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_biz uuid;
begin
  select id into v_biz from rx_businesses where review_hook_token = p_token and active;
  if v_biz is null then return jsonb_build_object('ok', false, 'error', 'unknown hook'); end if;
  if p_ref is not null and exists (select 1 from rx_review_requests where business_id = v_biz and external_ref = p_ref) then
    return jsonb_build_object('ok', true, 'dup', true);
  end if;
  return rx_review_enqueue(v_biz, p_name, p_phone, 'webhook', 'attested', null, interval '2 hours', p_ref);
end $$;

-- Google's number for the shop today. When the count goes up, the oldest recent taps get credited as 'reviewed'
-- (a best guess: Google never tells us who, so this is the closest honest count we can keep).
create or replace function public.rx_review_snapshot_save(p_business uuid, p_rating numeric, p_count int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev int; v_gain int;
begin
  select count into v_prev from rx_review_snapshots where business_id = p_business and day < (now() at time zone 'America/New_York')::date order by day desc limit 1;
  insert into rx_review_snapshots (business_id, rating, count) values (p_business, p_rating, p_count)
  on conflict (business_id, day) do update set rating = excluded.rating, count = excluded.count;
  v_gain := coalesce(p_count, 0) - coalesce(v_prev, p_count, 0);
  if v_gain > 0 then
    update rx_review_requests set status = 'reviewed' where id in (
      select id from rx_review_requests where business_id = p_business and status = 'clicked' and clicked_at > now() - interval '14 days'
      order by clicked_at asc limit v_gain);
  end if;
end $$;

-- Friday text to each owner: what went out, what got tapped, what Google shows now.
create or replace function public.rx_review_weekly_digest()
returns table (business_id uuid, business text, owner_phone text, asked bigint, clicked bigint, rating numeric, count int, gained int)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.id, b.name, b.owner_phone,
    (select count(*) from rx_review_requests r where r.business_id = b.id and r.sent_at > now() - interval '7 days'),
    (select count(*) from rx_review_requests r where r.business_id = b.id and r.clicked_at > now() - interval '7 days'),
    s.rating, s.count,
    s.count - (select s2.count from rx_review_snapshots s2 where s2.business_id = b.id and s2.day <= s.day - 7 order by s2.day desc limit 1)
  from rx_businesses b
  left join lateral (select rating, count, day from rx_review_snapshots where business_id = b.id order by day desc limit 1) s on true
  where b.review_engine and b.active and b.owner_phone is not null
$$;

revoke all on function public.rx_review_due(int), public.rx_review_mark(uuid, text, text, timestamptz), public.rx_review_click(text),
  public.rx_review_inbound(text, text, text), public.rx_review_hook(text, text, text, text), public.rx_review_snapshot_save(uuid, numeric, int),
  public.rx_review_weekly_digest() from public, anon, authenticated;
grant execute on function public.rx_review_due(int), public.rx_review_mark(uuid, text, text, timestamptz), public.rx_review_click(text),
  public.rx_review_inbound(text, text, text), public.rx_review_hook(text, text, text, text), public.rx_review_snapshot_save(uuid, numeric, int),
  public.rx_review_weekly_digest() to service_role;

-- ---------- shared read model (owner app + HQ) ----------
create or replace function public.rx_review_summary(p_business uuid, p_days int default 60) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'on', b.review_engine, 'review_url', b.review_url, 'google_place_id', b.google_place_id,
    'link', rx_review_link(b.review_url, b.google_place_id), 'hook_token', b.review_hook_token,
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'customer_name', r.customer_name, 'phone', r.phone, 'source', r.source,
                   'status', r.status, 'touches', r.touches, 'next_at', r.next_at, 'sent_at', r.sent_at, 'clicked_at', r.clicked_at,
                   'note', r.note, 'created_at', r.created_at) order by r.created_at desc), '[]')
                 from rx_review_requests r where r.business_id = b.id and (r.created_at > now() - make_interval(days => p_days) or r.status = 'queued')),
    'counts', (select jsonb_build_object(
        'queued',        count(*) filter (where status = 'queued'),
        'sent',          count(*) filter (where sent_at is not null),
        'clicked',       count(*) filter (where clicked_at is not null),
        'reviewed',      count(*) filter (where status = 'reviewed'),
        'stopped',       count(*) filter (where status = 'stopped'),
        'month_sent',    count(*) filter (where sent_at >= date_trunc('month', now())),
        'month_clicked', count(*) filter (where clicked_at >= date_trunc('month', now())),
        'week_sent',     count(*) filter (where sent_at > now() - interval '7 days'),
        'week_clicked',  count(*) filter (where clicked_at > now() - interval '7 days'))
       from rx_review_requests where business_id = b.id),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'sent', w.sent, 'clicked', w.clicked, 'reviewed', w.reviewed) order by w.week desc), '[]')
               from (select * from rx_review_weekly where business_id = b.id order by week desc limit 12) w),
    'google', (select jsonb_build_object('rating', s.rating, 'count', s.count, 'day', s.day,
                 'month_gain', s.count - (select s2.count from rx_review_snapshots s2 where s2.business_id = b.id and s2.day <= s.day - 30 order by s2.day desc limit 1))
               from rx_review_snapshots s where s.business_id = b.id order by s.day desc limit 1))
  from rx_businesses b where b.id = p_business
$$;
revoke all on function public.rx_review_summary(uuid, int) from public, anon, authenticated;
grant execute on function public.rx_review_summary(uuid, int) to service_role;   -- only called from the gated RPCs below

-- ---------- owner app: rx_owner_* ----------
create or replace function public.rx_owner_reviews(p_days int default 60) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  return rx_review_summary(v, p_days) - 'hook_token';
end $$;

-- The owner can set the link / Place ID. Switching the engine on stays with Nick (it is the paid product).
create or replace function public.rx_owner_review_settings(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  update rx_businesses set
    review_url = case when p ? 'review_url' then nullif(trim(p->>'review_url'), '') else review_url end,
    google_place_id = case when p ? 'google_place_id' then nullif(trim(p->>'google_place_id'), '') else google_place_id end,
    updated_at = now()
  where id = v;
end $$;

-- "Job done" button: one customer, texted in 2 hours (or right now).
create or replace function public.rx_owner_review_request(p_name text, p_phone text, p_now boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  return rx_review_enqueue(v, p_name, p_phone, 'manual', 'attested', null, case when p_now then interval '0' else interval '2 hours' end);
end $$;

-- Paste / CSV import: [{name, phone}, ...]. Returns {added, dup, bad}.
create or replace function public.rx_owner_review_import(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := rx_owner_business_id(); r jsonb; res jsonb; n_added int := 0; n_dup int := 0; n_bad int := 0;
begin
  if v is null then raise exception 'no business'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'Up to 500 rows at a time.'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    res := rx_review_enqueue(v, r->>'name', r->>'phone', 'import', 'attested');
    if (res->>'ok')::boolean is not true then n_bad := n_bad + 1;
    elsif (res->>'dup')::boolean is true then n_dup := n_dup + 1;
    else n_added := n_added + 1; end if;
  end loop;
  return jsonb_build_object('added', n_added, 'dup', n_dup, 'bad', n_bad);
end $$;

-- send_now | stop, on one of the shop's own requests
create or replace function public.rx_owner_review_action(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  if p_action = 'send_now' then
    update rx_review_requests set next_at = now() where id = p_id and business_id = v and status in ('queued', 'sent') and touches < 2;
  elsif p_action = 'stop' then
    update rx_review_requests set status = 'stopped', next_at = null, note = 'Stopped by the shop' where id = p_id and business_id = v and status in ('queued', 'sent');
  else raise exception 'unknown action'; end if;
end $$;

grant execute on function public.rx_owner_reviews(int), public.rx_owner_review_settings(jsonb), public.rx_owner_review_request(text, text, boolean),
  public.rx_owner_review_import(jsonb), public.rx_owner_review_action(uuid, text) to authenticated;
revoke execute on function public.rx_owner_reviews(int), public.rx_owner_review_settings(jsonb), public.rx_owner_review_request(text, text, boolean),
  public.rx_owner_review_import(jsonb), public.rx_owner_review_action(uuid, text) from public, anon;

-- ---------- HQ: hq_* ----------
create or replace function public.hq_reviews(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when is_hq_admin() then jsonb_build_object(
    'clients', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'active', b.active, 'on', b.review_engine,
                  'review_url', b.review_url, 'google_place_id', b.google_place_id, 'link', rx_review_link(b.review_url, b.google_place_id),
                  'hook_token', b.review_hook_token,
                  'queued',        (select count(*) from rx_review_requests r where r.business_id = b.id and r.status = 'queued'),
                  'sent',          (select count(*) from rx_review_requests r where r.business_id = b.id and r.sent_at is not null),
                  'clicked',       (select count(*) from rx_review_requests r where r.business_id = b.id and r.clicked_at is not null),
                  'month_sent',    (select count(*) from rx_review_requests r where r.business_id = b.id and r.sent_at >= date_trunc('month', now())),
                  'month_clicked', (select count(*) from rx_review_requests r where r.business_id = b.id and r.clicked_at >= date_trunc('month', now())),
                  'stopped',       (select count(*) from rx_review_requests r where r.business_id = b.id and r.status = 'stopped'),
                  'google',        (select jsonb_build_object('rating', s.rating, 'count', s.count) from rx_review_snapshots s where s.business_id = b.id order by s.day desc limit 1),
                  'last_sent',     (select max(r.last_touch_at) from rx_review_requests r where r.business_id = b.id))
                  order by b.review_engine desc, b.name), '[]') from rx_businesses b),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'business_id', r.business_id, 'business', b.name, 'customer_name', r.customer_name, 'phone', r.phone,
                   'source', r.source, 'status', r.status, 'touches', r.touches, 'next_at', r.next_at, 'sent_at', r.sent_at, 'clicked_at', r.clicked_at,
                   'note', r.note, 'created_at', r.created_at) order by r.created_at desc), '[]')
                 from rx_review_requests r join rx_businesses b on b.id = r.business_id
                 where r.created_at > now() - make_interval(days => p_days) or r.status = 'queued'),
    'month', jsonb_build_object(
       'sent',    (select count(*) from rx_review_requests where sent_at >= date_trunc('month', now())),
       'clicked', (select count(*) from rx_review_requests where clicked_at >= date_trunc('month', now())),
       'queued',  (select count(*) from rx_review_requests where status = 'queued'),
       'on',      (select count(*) from rx_businesses where review_engine and active))
  ) else null end
$$;

-- The one click: hq_review_settings(id, '{"on": true}'). Also saves the link / Place ID.
create or replace function public.hq_review_settings(p_business uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update rx_businesses set
    review_engine = coalesce((p->>'on')::boolean, review_engine),
    review_url = case when p ? 'review_url' then nullif(trim(p->>'review_url'), '') else review_url end,
    google_place_id = case when p ? 'google_place_id' then nullif(trim(p->>'google_place_id'), '') else google_place_id end,
    review_hook_token = case when (p->>'rotate_hook')::boolean then encode(gen_random_bytes(12), 'hex') else review_hook_token end,
    updated_at = now()
  where id = p_business;
end $$;

create or replace function public.hq_review_request(p_business uuid, p_name text, p_phone text, p_now boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  return rx_review_enqueue(p_business, p_name, p_phone, 'manual', 'attested', null, case when p_now then interval '0' else interval '2 hours' end);
end $$;

create or replace function public.hq_review_action(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if p_action = 'send_now' then
    update rx_review_requests set next_at = now() where id = p_id and status in ('queued', 'sent') and touches < 2;
  elsif p_action = 'stop' then
    update rx_review_requests set status = 'stopped', next_at = null, note = 'Stopped from HQ' where id = p_id and status in ('queued', 'sent');
  else raise exception 'unknown action'; end if;
end $$;

grant execute on function public.hq_reviews(int), public.hq_review_settings(uuid, jsonb), public.hq_review_request(uuid, text, text, boolean), public.hq_review_action(uuid, text) to authenticated;
revoke execute on function public.hq_reviews(int), public.hq_review_settings(uuid, jsonb), public.hq_review_request(uuid, text, text, boolean), public.hq_review_action(uuid, text) from public, anon;

-- Older review RPCs were granted to authenticated but never revoked from PUBLIC (today's audit). Close that here.
do $$ begin
  if to_regprocedure('public.hq_review_asks(int)') is not null then revoke execute on function public.hq_review_asks(int) from public, anon; end if;
  if to_regprocedure('public.rx_owner_review_url(text)') is not null then revoke execute on function public.rx_owner_review_url(text) from public, anon; end if;
end $$;

-- ---------- schedule (pg_cron + pg_net, same pattern as rx-review / meta-publish) ----------
-- The function checks x-rx-sync-secret (RX_SYNC_SECRET in rx_config, same as rx-sync and rx-review).
select cron.unschedule(jobid) from cron.job where jobname in ('rx-review-engine-send', 'rx-review-engine-snapshot', 'rx-review-engine-weekly');
select cron.schedule('rx-review-engine-send', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review-engine',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{"mode":"send"}'::jsonb)
$cron$);
select cron.schedule('rx-review-engine-snapshot', '20 11 * * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review-engine',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{"mode":"snapshot"}'::jsonb)
$cron$);
select cron.schedule('rx-review-engine-weekly', '5 21 * * 5', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review-engine',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{"mode":"weekly"}'::jsonb)
$cron$);
-- The old hourly rx-review job is superseded for every shop with review_engine = true (which, after the
-- backfill above, is every shop that had a review link). Leaving both running would double-text a job,
-- so the old one comes off the clock. Re-add with hq/supabase/006_hq_agents.sql if ever needed.
select cron.unschedule(jobid) from cron.job where jobname = 'rx-review-hourly';

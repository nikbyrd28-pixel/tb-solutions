-- TB Solutions — run this ONCE in Supabase → SQL editor (project "Base").
-- Paste the whole thing and hit run. It is idempotent: running it twice is harmless.
-- Until this runs, the Leads and Money tabs in the client app say "not switched on yet",
-- and the Call list shows "Not audited yet" on every prospect. Nothing is broken, just off.
--
-- Order matters: client tools adds rx_prospects.business_id, which recon's queue filters on.

-- ===================================================== 1/3  BILLING + STRIPE
-- HQ Billing: what each shop is on, what they owe, what they've paid, and what you owe them back.
--
-- You charge manually (Zelle, card, check, whatever). This is the ledger that tells you who to
-- chase and what the business is actually worth per month. Money is integer cents everywhere —
-- floats and money do not mix.
--
-- The guarantee is the reason the credits table exists: you promise "no job booked in 30 days,
-- the month's refunded" on every cold call. hq_guarantee_watch below works that out from the
-- real rx_jobs rows so it is never a thing you have to remember.
--
-- Run after 003_hq_call_list.sql. Idempotent.

-- What you sell. Seeded to match /offers/ exactly — if a price changes there, change it here.
create table if not exists public.hq_plans (
  slug              text primary key,
  name              text not null,
  setup_cents       int not null default 0,     -- list price
  setup_first5_cents int,                       -- launch price, null when there isn't one
  monthly_cents     int not null,
  active            boolean not null default true,
  sort              int not null default 100
);

insert into public.hq_plans (slug, name, setup_cents, setup_first5_cents, monthly_cents, sort) values
  ('never-miss-a-call', 'Never Miss a Call', 49700, 29700, 19700, 10),
  ('lead-engine',       'Lead Engine',       49700, 29700, 14700, 20),
  ('review-engine',     'Review Engine',         0,  null,  9700, 30),
  ('job-ready-website', 'Job-Ready Website', 49700,  null,  4700, 40),
  ('remodel-planner',   'Remodel Planner',   69700,  null,  6700, 50),
  ('bundle',            'The Bundle',        79700,  null, 29700,  5)
on conflict (slug) do update set
  name = excluded.name, setup_cents = excluded.setup_cents,
  setup_first5_cents = excluded.setup_first5_cents, monthly_cents = excluded.monthly_cents;

-- One row per product a shop is on. A shop can hold several.
create table if not exists public.hq_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.rx_businesses(id) on delete cascade,
  plan_slug     text not null references public.hq_plans(slug),
  monthly_cents int not null,                  -- what THIS shop actually agreed to pay
  setup_cents   int not null default 0,
  started_on    date not null default (now() at time zone 'America/New_York')::date,
  status        text not null default 'active', -- active | paused | cancelled
  cancelled_on  date,
  note          text,
  created_at    timestamptz not null default now(),
  unique (business_id, plan_slug)
);
create index if not exists hq_subs_business_idx on public.hq_subscriptions(business_id);
create index if not exists hq_subs_status_idx on public.hq_subscriptions(status);

create table if not exists public.hq_invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.rx_businesses(id) on delete cascade,
  number         text,                          -- whatever you write on it
  period_start   date,
  period_end     date,
  issued_on      date not null default (now() at time zone 'America/New_York')::date,
  due_on         date,
  subtotal_cents int not null default 0,
  credit_cents   int not null default 0,        -- credits applied to this invoice
  total_cents    int generated always as (greatest(0, subtotal_cents - credit_cents)) stored,
  status         text not null default 'draft', -- draft | sent | paid | void
  paid_on        date,
  method         text,                          -- zelle | card | check | cash
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists hq_inv_business_idx on public.hq_invoices(business_id, issued_on desc);
create index if not exists hq_inv_status_idx on public.hq_invoices(status, due_on);

create table if not exists public.hq_invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.hq_invoices(id) on delete cascade,
  description text not null,
  kind        text not null default 'monthly',  -- setup | monthly | adjustment
  amount_cents int not null
);
create index if not exists hq_inv_lines_idx on public.hq_invoice_lines(invoice_id);

-- Money you owe a shop back. Unapplied until it lands on an invoice.
create table if not exists public.hq_credits (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  cents       int not null check (cents > 0),
  reason      text not null default 'guarantee', -- guarantee | goodwill | referral | other
  note        text,
  issued_on   date not null default (now() at time zone 'America/New_York')::date,
  applied_invoice_id uuid references public.hq_invoices(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists hq_credits_business_idx on public.hq_credits(business_id)
  where applied_invoice_id is null;

-- Keep an invoice's subtotal honest: it is always the sum of its lines.
create or replace function public.hq_invoice_resum() returns trigger language plpgsql as $$
declare inv uuid;
begin
  inv := coalesce(new.invoice_id, old.invoice_id);
  update public.hq_invoices i
    set subtotal_cents = coalesce((select sum(amount_cents) from public.hq_invoice_lines where invoice_id = inv), 0)
  where i.id = inv;
  return null;
end $$;
drop trigger if exists hq_invoice_lines_resum on public.hq_invoice_lines;
create trigger hq_invoice_lines_resum after insert or update or delete on public.hq_invoice_lines
  for each row execute function public.hq_invoice_resum();

-- The 30-day guarantee, worked out from real booked jobs rather than memory.
-- "No job booked in 30 days, the month's refunded." Owed the moment the window closes empty.
create or replace view public.hq_guarantee_watch with (security_invoker = true) as
select s.business_id,
       b.name,
       s.plan_slug,
       s.started_on,
       (s.started_on + 30) as window_ends,
       (select count(*) from public.rx_jobs j
         where j.business_id = s.business_id
           and j.created_at >= s.started_on
           and j.created_at < (s.started_on + 31)) as jobs_booked,
       ((now() at time zone 'America/New_York')::date - s.started_on) as days_in,
       s.monthly_cents,
       case
         when (now() at time zone 'America/New_York')::date <= (s.started_on + 30) then 'watching'
         when (select count(*) from public.rx_jobs j
                where j.business_id = s.business_id
                  and j.created_at >= s.started_on
                  and j.created_at < (s.started_on + 31)) > 0 then 'met'
         when exists (select 1 from public.hq_credits c
                       where c.business_id = s.business_id and c.reason = 'guarantee') then 'refunded'
         else 'owed'
       end as state
from public.hq_subscriptions s
join public.rx_businesses b on b.id = s.business_id
where s.status = 'active' and s.plan_slug in ('never-miss-a-call', 'bundle');

alter table public.hq_plans         enable row level security;
alter table public.hq_subscriptions enable row level security;
alter table public.hq_invoices      enable row level security;
alter table public.hq_invoice_lines enable row level security;
alter table public.hq_credits       enable row level security;

-- ---------- RPCs for the HQ Billing tab (admin only, same gate as every other hq_*) ----------

create or replace function public.hq_billing() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'plans', (select coalesce(jsonb_agg(to_jsonb(p) order by p.sort), '[]') from hq_plans p where p.active),
    'mrr_cents', (select coalesce(sum(monthly_cents), 0) from hq_subscriptions where status = 'active'),
    'outstanding_cents', (select coalesce(sum(total_cents), 0) from hq_invoices where status in ('draft','sent')),
    'overdue_cents', (select coalesce(sum(total_cents), 0) from hq_invoices
                       where status = 'sent' and due_on < (now() at time zone 'America/New_York')::date),
    'credits_open_cents', (select coalesce(sum(cents), 0) from hq_credits where applied_invoice_id is null),
    'clients', (select coalesce(jsonb_agg(c order by c->>'name'), '[]') from (
        select jsonb_build_object(
          'business_id', b.id, 'name', b.name, 'slug', b.slug, 'owner_phone', b.owner_phone, 'active', b.active,
          'subs', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', s.id, 'plan_slug', s.plan_slug, 'plan', p.name, 'monthly_cents', s.monthly_cents,
                      'setup_cents', s.setup_cents, 'started_on', s.started_on, 'status', s.status, 'note', s.note)
                      order by p.sort), '[]')
                   from hq_subscriptions s join hq_plans p on p.slug = s.plan_slug where s.business_id = b.id),
          'monthly_cents', (select coalesce(sum(monthly_cents),0) from hq_subscriptions where business_id = b.id and status='active'),
          'owed_cents', (select coalesce(sum(total_cents),0) from hq_invoices where business_id = b.id and status in ('draft','sent')),
          'credit_cents', (select coalesce(sum(cents),0) from hq_credits where business_id = b.id and applied_invoice_id is null),
          'guarantee', (select to_jsonb(g) from hq_guarantee_watch g where g.business_id = b.id limit 1)
        ) as c from rx_businesses b) x),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'business_id', i.business_id, 'name', b.name, 'number', i.number,
        'period_start', i.period_start, 'period_end', i.period_end, 'issued_on', i.issued_on, 'due_on', i.due_on,
        'subtotal_cents', i.subtotal_cents, 'credit_cents', i.credit_cents, 'total_cents', i.total_cents,
        'status', i.status, 'paid_on', i.paid_on, 'method', i.method, 'note', i.note,
        'overdue', (i.status = 'sent' and i.due_on < (now() at time zone 'America/New_York')::date),
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('description', l.description, 'kind', l.kind, 'amount_cents', l.amount_cents)), '[]')
                  from hq_invoice_lines l where l.invoice_id = i.id))
        order by i.issued_on desc, i.created_at desc), '[]')
      from hq_invoices i join rx_businesses b on b.id = i.business_id
      where i.issued_on > (now() at time zone 'America/New_York')::date - 365),
    'credits', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'business_id', c.business_id, 'name', b.name, 'cents', c.cents, 'reason', c.reason,
        'note', c.note, 'issued_on', c.issued_on, 'applied', c.applied_invoice_id is not null) order by c.issued_on desc), '[]')
      from hq_credits c join rx_businesses b on b.id = c.business_id)
  ) else null end
$$;

create or replace function public.hq_sub_save(p_business uuid, p_plan text, p_monthly_cents int,
  p_setup_cents int default null, p_status text default 'active', p_started date default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into hq_subscriptions (business_id, plan_slug, monthly_cents, setup_cents, status, started_on, note)
  values (p_business, p_plan, p_monthly_cents, coalesce(p_setup_cents, 0), p_status,
          coalesce(p_started, (now() at time zone 'America/New_York')::date), p_note)
  on conflict (business_id, plan_slug) do update set
    monthly_cents = excluded.monthly_cents,
    setup_cents   = excluded.setup_cents,
    status        = excluded.status,
    started_on    = excluded.started_on,
    note          = coalesce(excluded.note, hq_subscriptions.note),
    cancelled_on  = case when excluded.status = 'cancelled'
                         then coalesce(hq_subscriptions.cancelled_on, (now() at time zone 'America/New_York')::date)
                         else null end
  returning id into v;
  return v;
end $$;

-- Build next month's invoice for a shop from whatever it is actually subscribed to,
-- and sweep any unapplied credits onto it. One button, no arithmetic by hand.
create or replace function public.hq_invoice_build(p_business uuid, p_period_start date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv uuid; ps date; pe date; today date := (now() at time zone 'America/New_York')::date; applied int;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  ps := coalesce(p_period_start, date_trunc('month', today)::date);
  pe := (ps + interval '1 month - 1 day')::date;

  insert into hq_invoices (business_id, period_start, period_end, due_on, status)
  values (p_business, ps, pe, ps + 7, 'draft') returning id into inv;

  -- monthly line per active subscription
  insert into hq_invoice_lines (invoice_id, description, kind, amount_cents)
  select inv, p.name || ' — ' || to_char(ps, 'Mon YYYY'), 'monthly', s.monthly_cents
  from hq_subscriptions s join hq_plans p on p.slug = s.plan_slug
  where s.business_id = p_business and s.status = 'active';

  -- setup fee, once, on the first invoice that covers the month they started
  insert into hq_invoice_lines (invoice_id, description, kind, amount_cents)
  select inv, p.name || ' — setup', 'setup', s.setup_cents
  from hq_subscriptions s join hq_plans p on p.slug = s.plan_slug
  where s.business_id = p_business and s.status = 'active' and s.setup_cents > 0
    and s.started_on between ps and pe
    and not exists (select 1 from hq_invoice_lines l join hq_invoices i2 on i2.id = l.invoice_id
                     where i2.business_id = p_business and l.kind = 'setup'
                       and l.description = p.name || ' — setup' and i2.status <> 'void');

  -- sweep open credits onto it
  update hq_credits set applied_invoice_id = inv
  where business_id = p_business and applied_invoice_id is null;
  get diagnostics applied = row_count;

  update hq_invoices set credit_cents = coalesce(
    (select sum(cents) from hq_credits where applied_invoice_id = inv), 0) where id = inv;

  return (select to_jsonb(i) || jsonb_build_object('credits_applied', applied) from hq_invoices i where i.id = inv);
end $$;

create or replace function public.hq_invoice_set(p_id uuid, p_status text, p_method text default null,
  p_due_on date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update hq_invoices set
    status  = coalesce(p_status, status),
    method  = coalesce(p_method, method),
    due_on  = coalesce(p_due_on, due_on),
    note    = coalesce(p_note, note),
    paid_on = case when p_status = 'paid' then coalesce(paid_on, (now() at time zone 'America/New_York')::date)
                   when p_status is not null then null else paid_on end
  where id = p_id;
  -- a voided invoice releases its credits back to the pool
  if p_status = 'void' then
    update hq_credits set applied_invoice_id = null where applied_invoice_id = p_id;
    update hq_invoices set credit_cents = 0 where id = p_id;
  end if;
  return (select to_jsonb(i) from hq_invoices i where i.id = p_id);
end $$;

create or replace function public.hq_credit_add(p_business uuid, p_cents int,
  p_reason text default 'guarantee', p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into hq_credits (business_id, cents, reason, note) values (p_business, p_cents, p_reason, p_note)
  returning id into v;
  return (select to_jsonb(c) from hq_credits c where c.id = v);
end $$;

grant execute on function public.hq_billing() to authenticated;
grant execute on function public.hq_sub_save(uuid, text, int, int, text, date, text) to authenticated;
grant execute on function public.hq_invoice_build(uuid, date) to authenticated;
grant execute on function public.hq_invoice_set(uuid, text, text, date, text) to authenticated;
grant execute on function public.hq_credit_add(uuid, int, text, text) to authenticated;

-- Stripe Checkout. Idempotency lives here: a session id is recorded when the invoice is sent
-- for payment, and the webhook refuses to pay the same session twice.
alter table public.hq_invoices add column if not exists stripe_session_id text;
alter table public.hq_invoices add column if not exists stripe_payment_intent text;
create unique index if not exists hq_invoices_stripe_session_idx on public.hq_invoices(stripe_session_id)
  where stripe_session_id is not null;

-- Called by the rx-pay edge function with the service role after Stripe confirms payment.
-- Writing this as a function rather than a raw update keeps the paid rules in one place.
create or replace function public.hq_invoice_mark_paid(p_session text, p_intent text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.hq_invoices;
begin
  update public.hq_invoices set
    status  = 'paid',
    paid_on = coalesce(paid_on, (now() at time zone 'America/New_York')::date),
    method  = coalesce(method, 'stripe'),
    stripe_payment_intent = coalesce(p_intent, stripe_payment_intent)
  where stripe_session_id = p_session and status <> 'paid'
  returning * into r;
  -- Already paid, or no such session: say so rather than pretending something happened.
  if not found then
    return jsonb_build_object('updated', false,
      'reason', case when exists (select 1 from public.hq_invoices where stripe_session_id = p_session)
                     then 'already paid' else 'unknown session' end);
  end if;
  return jsonb_build_object('updated', true, 'invoice', to_jsonb(r));
end $$;

-- The edge function records the Checkout session id before sending the client to Stripe.
create or replace function public.hq_invoice_set_session(p_invoice uuid, p_session text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hq_invoices set stripe_session_id = p_session where id = p_invoice and status = 'sent';
end $$;

-- ===================================================== 2/3  CLIENT TOOLS
-- Client tools: the lead agent, scripts and billing, for the shops — not just for TB Solutions.
--
-- Until now rx_prospects WAS Nick's cold-call list, full stop. Now every prospect belongs to
-- someone: business_id null means it is Nick's own list, business_id set means it is that
-- client's list, which they see in their own app at /receptionist/app/.
--
-- A plumber's prospects are not homeowners — they are the people who hand out repeat work:
-- property managers, realtors, builders, GCs, restaurants with a kitchen to keep running.
-- rx_prospect_targets is where each client says who they want.
--
-- Run after 006_rx_call_recording.sql. Idempotent.

alter table public.rx_prospects add column if not exists business_id uuid
  references public.rx_businesses(id) on delete cascade;
create index if not exists rx_prospects_owner_idx on public.rx_prospects(business_id, status, score desc);

-- CRITICAL: Nick's own list is the rows with no owner. Without this filter his HQ Call list
-- would fill up with his clients' prospects.
create or replace function public.hq_prospects(p_status text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(to_jsonb(p) order by
        (case when p.status in ('won','dead') then 2
              when p.status = 'new' or (p.callback_at is not null and p.callback_at <= now()) then 0
              else 1 end),
        p.callback_at nulls last, p.score desc, p.created_at desc), '[]')
    from rx_prospects p
    where p.business_id is null and (p_status is null or p.status = p_status)
  ) else null end
$$;

create or replace function public.hq_prospect_slots(p_cap int default 30)
returns int language sql stable as $$
  select greatest(0, p_cap - (select count(*)::int from public.rx_prospects
                               where status = 'new' and business_id is null))
$$;

-- What each client wants prospected for them.
create table if not exists public.rx_prospect_targets (
  business_id uuid primary key references public.rx_businesses(id) on delete cascade,
  enabled     boolean not null default false,
  cap         int not null default 20,          -- their call list cap, same idea as Nick's 30
  looking_for text[] not null default '{}',     -- {'property managers','realtors','builders','general contractors'}
  towns       text[] not null default '{}',     -- empty = use the business's own service area
  pitch       text,                             -- what they open with, in their words
  notes       text,
  updated_at  timestamptz not null default now()
);
alter table public.rx_prospect_targets enable row level security;

-- How many a client's list may take right now. Same contract as Nick's.
create or replace function public.rx_prospect_slots(p_business uuid)
returns int language sql stable as $$
  select greatest(0, coalesce((select cap from public.rx_prospect_targets where business_id = p_business), 20)
                   - (select count(*)::int from public.rx_prospects
                       where status = 'new' and business_id = p_business))
$$;

-- ---------- what the client sees in their app ----------

create or replace function public.rx_owner_prospects() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  return jsonb_build_object(
    'target', (select to_jsonb(t) from rx_prospect_targets t where t.business_id = v),
    'slots', rx_prospect_slots(v),
    'prospects', (select coalesce(jsonb_agg(to_jsonb(p) order by
        (case when p.status in ('won','dead') then 2
              when p.status = 'new' or (p.callback_at is not null and p.callback_at <= now()) then 0
              else 1 end),
        p.callback_at nulls last, p.score desc, p.created_at desc), '[]')
      from rx_prospects p where p.business_id = v)
  );
end $$;

-- The same one-tap dial log the HQ Call list uses, scoped to the caller's own shop.
create or replace function public.rx_owner_prospect_log(p_id uuid, p_outcome text,
  p_note text default null, p_callback_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from rx_prospects where id = p_id and business_id = v) then
    raise exception 'not your prospect';
  end if;
  -- hq_prospect_log holds the attempt counting, callback scheduling and six-try retirement.
  -- It is admin-gated, so the work is inlined here against the already-ownership-checked row.
  return (select public.rx_prospect_log_inner(p_id, p_outcome, p_note, p_callback_at));
end $$;

-- Shared body: identical rules for Nick's list and a client's list, written once.
create or replace function public.rx_prospect_log_inner(p_id uuid, p_outcome text,
  p_note text default null, p_callback_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.rx_prospects; new_status text; cb timestamptz; dialed boolean;
begin
  select * into r from public.rx_prospects where id = p_id;
  if not found then raise exception 'no such prospect'; end if;

  dialed := p_outcome is distinct from 'note';
  new_status := case when dialed then p_outcome else r.status end;
  cb := coalesce(p_callback_at, case p_outcome
          when 'no_answer' then hq_next_business_morning(1)
          when 'voicemail' then hq_next_business_morning(3)
          when 'talking'   then hq_next_business_morning(2)
          else null end);
  if p_outcome in ('won','dead') then cb := null; end if;
  if p_outcome = 'note' then cb := coalesce(p_callback_at, r.callback_at); end if;

  if dialed and p_outcome in ('no_answer','voicemail') and r.attempts + 1 >= 6 then
    new_status := 'dead'; cb := null;
    p_note := coalesce(nullif(p_note,'') || ' — ', '') || 'retired after 6 tries, no contact';
  end if;

  update public.rx_prospects set
    status = new_status,
    attempts = r.attempts + case when dialed then 1 else 0 end,
    last_outcome = case when dialed then p_outcome else r.last_outcome end,
    callback_at = cb, last_touch = now(),
    notes = case when nullif(trim(coalesce(p_note,'')),'') is null then r.notes
                 else coalesce(r.notes || E'\n', '')
                      || to_char(now() at time zone 'America/New_York', 'Mon DD HH12:MIam') || ' · '
                      || case when dialed then upper(replace(p_outcome,'_',' ')) || ': ' else '' end
                      || trim(p_note) end
  where id = p_id returning * into r;
  return to_jsonb(r);
end $$;

-- Point the HQ version at the shared body so the two can never drift apart.
create or replace function public.hq_prospect_log(p_id uuid, p_outcome text,
  p_note text default null, p_callback_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  return public.rx_prospect_log_inner(p_id, p_outcome, p_note, p_callback_at);
end $$;

-- What they owe, what they're on, what you owe them. Read-only — billing is yours to change.
-- Degrades to nulls rather than erroring if the billing tables are not installed yet.
create or replace function public.rx_owner_billing() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  if to_regclass('public.hq_invoices') is null then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object('enabled', true,
    'subs', (select coalesce(jsonb_agg(jsonb_build_object('plan', p.name, 'monthly_cents', s.monthly_cents,
               'started_on', s.started_on, 'status', s.status) order by p.sort), '[]')
             from hq_subscriptions s join hq_plans p on p.slug = s.plan_slug
             where s.business_id = v and s.status <> 'cancelled'),
    'monthly_cents', (select coalesce(sum(monthly_cents),0) from hq_subscriptions where business_id = v and status = 'active'),
    'credit_cents', (select coalesce(sum(cents),0) from hq_credits where business_id = v and applied_invoice_id is null),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'period_start', i.period_start,
               'period_end', i.period_end, 'issued_on', i.issued_on, 'due_on', i.due_on,
               'subtotal_cents', i.subtotal_cents, 'credit_cents', i.credit_cents, 'total_cents', i.total_cents,
               'status', i.status, 'paid_on', i.paid_on,
               'lines', (select coalesce(jsonb_agg(jsonb_build_object('description', l.description, 'amount_cents', l.amount_cents)), '[]')
                         from hq_invoice_lines l where l.invoice_id = i.id))
               order by i.issued_on desc), '[]')
             from hq_invoices i where i.business_id = v and i.status <> 'draft'));
end $$;

grant execute on function public.rx_owner_prospects(), public.rx_owner_prospect_log(uuid,text,text,timestamptz),
  public.rx_owner_billing(), public.rx_prospect_slots(uuid) to authenticated;

-- A client asking to pay one of their own invoices. Returns only what Checkout needs.
-- Refuses drafts, refuses invoices already paid, refuses anything that is not theirs.
create or replace function public.rx_owner_invoice_for_pay(p_invoice uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id(); r record;
begin
  if v is null then raise exception 'not signed in'; end if;
  if to_regclass('public.hq_invoices') is null then raise exception 'billing not installed'; end if;
  select i.id, i.total_cents, i.status, i.period_start, i.period_end, i.stripe_session_id, b.name
    into r from hq_invoices i join rx_businesses b on b.id = i.business_id
    where i.id = p_invoice and i.business_id = v;
  if not found then raise exception 'not your invoice'; end if;
  if r.status = 'paid' then raise exception 'already paid'; end if;
  if r.status <> 'sent' then raise exception 'not payable yet'; end if;
  if r.total_cents <= 0 then raise exception 'nothing to pay'; end if;
  return jsonb_build_object('id', r.id, 'amount_cents', r.total_cents, 'name', r.name,
    'period_start', r.period_start, 'period_end', r.period_end);
end $$;

grant execute on function public.rx_owner_invoice_for_pay(uuid) to authenticated;

-- ===================================================== 3/3  RECON
-- Recon: the audit that turns a cold call into a specific one.
--
-- Today an opener is "listed closed weekends". After recon it is "you're paying Google for
-- leads and your profile has no hours — those clicks land on a closed sign." Same prospect,
-- completely different call.
--
-- Everything stored here is PUBLIC information: their own website, their Google Business
-- Profile, the Google Guaranteed badge in search results, and the Meta Ad Library, which
-- Meta publishes deliberately. Nothing is scraped from behind a login and nobody is contacted.
--
-- Run after 004_hq_billing.sql. Idempotent.

-- 007_client_tools.sql adds this too; repeated here so recon can be run on its own.
alter table public.rx_prospects add column if not exists business_id uuid
  references public.rx_businesses(id) on delete cascade;

alter table public.rx_prospects add column if not exists audit jsonb;
alter table public.rx_prospects add column if not exists audited_at timestamptz;
create index if not exists rx_prospects_audit_idx on public.rx_prospects(audited_at nulls first)
  where status = 'new';

-- Who to audit next: uncalled prospects, best score first, never audited or gone stale.
-- Capped so a run cannot blow up; recon costs real time per prospect.
create or replace function public.hq_audit_queue(p_limit int default 10, p_stale_days int default 60)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'trade', p.trade, 'city', p.city, 'zip', p.zip,
      'phone', p.phone, 'website', p.website, 'rating', p.rating, 'reviews', p.reviews,
      'hours_note', p.hours_note, 'google_place_id', p.google_place_id, 'why', p.why,
      'audited_at', p.audited_at) order by p.score desc, p.created_at), '[]')
    from (select * from rx_prospects
           where business_id is null and status = 'new'
             and (audited_at is null or audited_at < now() - make_interval(days => p_stale_days))
           order by score desc, created_at limit p_limit) p
  ) else null end
$$;

-- Write one prospect's audit. The opener is the point of the whole exercise: one sentence
-- Nick can say out loud that proves he actually looked at their business.
create or replace function public.hq_prospect_audit(p_id uuid, p_audit jsonb, p_opener text default null,
  p_score_delta int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.rx_prospects;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update public.rx_prospects set
    audit = p_audit,
    audited_at = now(),
    why = coalesce(nullif(trim(coalesce(p_opener,'')), ''), why),
    score = greatest(0, least(100, score + coalesce(p_score_delta, 0)))
  where id = p_id returning * into r;
  if not found then raise exception 'no such prospect'; end if;
  return to_jsonb(r);
end $$;

grant execute on function public.hq_audit_queue(int, int) to authenticated;
grant execute on function public.hq_prospect_audit(uuid, jsonb, text, int) to authenticated;
-- The marketing fleet. Three writers (GBP, Meta, Content) and one sender (Review).
--
-- The writers are scheduled Claude tasks. They cannot post to Google or Meta for Nick —
-- there is no API token for either — so they write finished posts into `agent_posts`,
-- and HQ shows them with a Copy button. Nick pastes, taps "Posted", done. The agent's
-- status in HQ is read from these rows, never from what the agent says about itself.
--
-- The Review agent is an edge function (rx-review) on pg_cron: when a receptionist job is
-- marked done and the customer agreed to texts on the call, it texts them the shop's
-- Google review link once, and logs exactly what it did (or why it skipped) in rx_review_asks.
--
-- Run after 005_hq_recon.sql. Idempotent.

-- ---------- posts written by the agents ----------
create table if not exists public.agent_posts (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('gbp','meta','content')),
  channel text not null check (channel in ('gbp','facebook','instagram','script')),
  business_id uuid references public.rx_businesses(id) on delete set null, -- null = TB Solutions itself
  title text,
  body text not null,
  caption text,                 -- IG/FB caption or the on-screen text for a script
  cta_url text,
  media_note text,              -- what photo/video to attach, in plain words
  status text not null default 'draft' check (status in ('draft','posted','skipped')),
  posted_at timestamptz,
  run_note text,                -- one line from the agent about why this post, this week
  created_at timestamptz not null default now()
);
create index if not exists agent_posts_status_idx on public.agent_posts(status, created_at desc);
alter table public.agent_posts enable row level security;   -- no policies: RPCs + service role only

create or replace function public.hq_agent_posts(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'agent',p.agent,'channel',p.channel,'business',b.name,'title',p.title,'body',p.body,
      'caption',p.caption,'cta_url',p.cta_url,'media_note',p.media_note,'status',p.status,
      'posted_at',p.posted_at,'run_note',p.run_note,'created_at',p.created_at)
      order by (p.status='draft') desc, p.created_at desc), '[]')
    from agent_posts p left join rx_businesses b on b.id = p.business_id
    where p.created_at > now() - make_interval(days => p_days) or p.status = 'draft'
  ) else null end
$$;

create or replace function public.hq_agent_post_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set status = p_status,
    posted_at = case when p_status = 'posted' then now() else null end
  where id = p_id;
end $$;

create or replace function public.hq_agent_post_edit(p_id uuid, p_body text, p_caption text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update agent_posts set body = p_body, caption = p_caption where id = p_id;
end $$;

-- ---------- review asks (sent by rx-review) ----------
alter table public.rx_businesses add column if not exists review_url text;

create table if not exists public.rx_review_asks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.rx_jobs(id) on delete cascade,
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  phone text,
  status text not null check (status in ('sent','skipped','failed')),
  reason text,                  -- for skipped/failed: 'no_consent' | 'no_review_url' | 'no_phone' | twilio error
  created_at timestamptz not null default now()
);
create index if not exists rx_review_asks_biz_idx on public.rx_review_asks(business_id, created_at desc);
alter table public.rx_review_asks enable row level security;

create or replace function public.hq_review_asks(p_days int default 60) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'asks', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'business',b.name,'customer',j.customer_name,'phone',a.phone,
                'status',a.status,'reason',a.reason,'created_at',a.created_at) order by a.created_at desc), '[]')
             from rx_review_asks a join rx_businesses b on b.id=a.business_id join rx_jobs j on j.id=a.job_id
             where a.created_at > now() - make_interval(days => p_days)),
    'no_url', (select coalesce(jsonb_agg(b.name), '[]') from rx_businesses b where b.active and b.review_url is null),
    'pending', (select count(*) from rx_jobs j where j.status='done' and not exists (select 1 from rx_review_asks a where a.job_id=j.id))
  ) else null end
$$;

-- let the brain editor save the review link
create or replace function public.hq_rx_business_save(p_id uuid, p jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update rx_businesses set
    name = coalesce(p->>'name', name),
    trade = coalesce(p->>'trade', trade),
    owner_name = coalesce(p->>'owner_name', owner_name),
    owner_phone = coalesce(p->>'owner_phone', owner_phone),
    agent_name = coalesce(p->>'agent_name', agent_name),
    agent_number = case when p ? 'agent_number' then nullif(p->>'agent_number','') else agent_number end,
    timezone = coalesce(p->>'timezone', timezone),
    service_zips = case when p ? 'service_zips' then array(select jsonb_array_elements_text(p->'service_zips')) else service_zips end,
    service_area_note = case when p ? 'service_area_note' then nullif(p->>'service_area_note','') else service_area_note end,
    service_fee_cents = case when p ? 'service_fee_cents' then (p->>'service_fee_cents')::int else service_fee_cents end,
    after_hours_fee_cents = case when p ? 'after_hours_fee_cents' then (p->>'after_hours_fee_cents')::int else after_hours_fee_cents end,
    free_estimates = coalesce((p->>'free_estimates')::boolean, free_estimates),
    hours = coalesce(p->'hours', hours),
    windows = coalesce(p->'windows', windows),
    jobs_per_window = coalesce((p->>'jobs_per_window')::int, jobs_per_window),
    emergency_policy = coalesce(p->>'emergency_policy', emergency_policy),
    transfer_number = case when p ? 'transfer_number' then nullif(p->>'transfer_number','') else transfer_number end,
    knowledge = case when p ? 'knowledge' then p->>'knowledge' else knowledge end,
    review_url = case when p ? 'review_url' then nullif(p->>'review_url','') else review_url end,
    active = coalesce((p->>'active')::boolean, active),
    updated_at = now()
  where id = p_id;
end $$;

grant execute on function public.hq_agent_posts(int), public.hq_agent_post_status(uuid,text), public.hq_agent_post_edit(uuid,text,text), public.hq_review_asks(int) to authenticated;
revoke execute on function public.hq_agent_posts(int), public.hq_agent_post_status(uuid,text), public.hq_agent_post_edit(uuid,text,text), public.hq_review_asks(int) from anon;

-- ---------- run rx-review every hour ----------
-- The function checks its own secret (RX_SYNC_SECRET, same one rx-sync uses).
select cron.unschedule(jobid) from cron.job where jobname = 'rx-review-hourly';
select cron.schedule('rx-review-hourly', '15 * * * *', $cron$
  select net.http_post(
    url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review',
    headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce((select value from public.rx_config where key='RX_SYNC_SECRET'),'')),
    body := '{}'::jsonb)

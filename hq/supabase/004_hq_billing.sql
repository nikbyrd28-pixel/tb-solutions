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

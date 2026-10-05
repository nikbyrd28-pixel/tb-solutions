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

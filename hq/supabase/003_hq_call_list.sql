-- HQ Call list: callbacks, attempt tracking, and a status set that keeps the list callable.
--
-- The problem this fixes: every dial left the prospect sitting in the same bucket, so
-- "called, no pickup" piled up on top of the people actually worth calling today.
-- Now a prospect you couldn't reach schedules itself and LEAVES the list until it's due.
--
-- Statuses: new → no_answer | voicemail | callback | talking | meeting → won | dead
-- Run after 001_hq.sql. Idempotent.

-- Who to ask for, and where to email. Google Places gives neither, so the Prospector
-- reads the shop's own website for them. Partial by design: plenty of small shops
-- publish no name and no address. Never guessed, left null instead.
alter table public.rx_prospects add column if not exists owner_name   text;
alter table public.rx_prospects add column if not exists email        text;

alter table public.rx_prospects add column if not exists callback_at  timestamptz;
alter table public.rx_prospects add column if not exists attempts     int not null default 0;
alter table public.rx_prospects add column if not exists last_outcome text;

create index if not exists rx_prospects_due_idx on public.rx_prospects(callback_at)
  where callback_at is not null and status not in ('won','dead');
create index if not exists rx_prospects_status_idx on public.rx_prospects(status, score desc);

-- The old UI wrote 'called' for "dialled, nothing happened". That's a no-answer.
update public.rx_prospects set status = 'no_answer' where status = 'called';

-- Next weekday morning at 9am ET, p_days out. Nobody cold-calls a plumber at 2am Sunday.
create or replace function public.hq_next_business_morning(p_days int default 1)
returns timestamptz language sql stable as $$
  select (d + time '09:00') at time zone 'America/New_York'
  from (
    select case extract(isodow from base)
             when 6 then base + 2            -- Sat → Mon
             when 7 then base + 1            -- Sun → Mon
             else base end as d
    from (select ((now() at time zone 'America/New_York')::date + p_days) as base) b
  ) s
$$;

-- One call per dial: appends the note, moves the status, bumps the attempt count,
-- and sets when it should come back. Everything the Call list needs in one round trip.
create or replace function public.hq_prospect_log(
  p_id uuid,
  p_outcome text,                      -- no_answer | voicemail | callback | talking | meeting | won | dead | note
  p_note text default null,
  p_callback_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rx_prospects;
  new_status text;
  cb timestamptz;
  dialed boolean;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  select * into r from public.rx_prospects where id = p_id;
  if not found then raise exception 'no such prospect'; end if;

  -- 'note' records a thought without claiming you dialled.
  dialed := p_outcome is distinct from 'note';
  new_status := case when dialed then p_outcome else r.status end;

  -- Default when it comes back, unless the caller picked a time.
  cb := coalesce(p_callback_at, case p_outcome
          when 'no_answer' then hq_next_business_morning(1)
          when 'voicemail' then hq_next_business_morning(3)
          when 'talking'   then hq_next_business_morning(2)
          else null end);
  if p_outcome in ('won','dead') then cb := null; end if;
  if p_outcome = 'note' then cb := coalesce(p_callback_at, r.callback_at); end if;

  -- Six tries with nobody picking up is a dead number, not a to-do. Stop it clogging the list.
  if dialed and p_outcome in ('no_answer','voicemail') and r.attempts + 1 >= 6 then
    new_status := 'dead';
    cb := null;
    p_note := coalesce(nullif(p_note,'') || ' — ', '') || 'retired after 6 tries, no contact';
  end if;

  update public.rx_prospects set
    status       = new_status,
    attempts     = r.attempts + case when dialed then 1 else 0 end,
    last_outcome = case when dialed then p_outcome else r.last_outcome end,
    callback_at  = cb,
    last_touch   = now(),
    notes        = case when nullif(trim(coalesce(p_note,'')),'') is null then r.notes
                        else coalesce(r.notes || E'\n', '')
                             || to_char(now() at time zone 'America/New_York', 'Mon DD HH12:MIam') || ' · '
                             || case when dialed then upper(replace(p_outcome,'_',' ')) || ': ' else '' end
                             || trim(p_note) end
  where id = p_id
  returning * into r;

  return to_jsonb(r);
end $$;

-- Call list, ordered the way you work it: what's due now (best score first), then everything else.
create or replace function public.hq_prospects(p_status text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (
    select coalesce(jsonb_agg(to_jsonb(p) order by
        (case when p.status in ('won','dead') then 2
              when p.status = 'new' or (p.callback_at is not null and p.callback_at <= now()) then 0
              else 1 end),
        p.callback_at nulls last,
        p.score desc,
        p.created_at desc), '[]')
    from rx_prospects p where p_status is null or p.status = p_status
  ) else null end
$$;

grant execute on function public.hq_prospect_log(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.hq_next_business_morning(int) to authenticated;

-- ============================================================================
-- LOOP CRM — THE RUN, and the outreach machine it drives.
--
-- ── WHAT THIS FIXES ─────────────────────────────────────────────────────────
-- The CRM board answers "what is the state of everything". It does not answer
-- the only question asked at 9am on a Tuesday: who do I ring first. The board's
-- "Chase today" tab is close but it is fed by a date Nick had to type. Forty-
-- four of the forty-five shops have never had one typed, so on a normal morning
-- that tab is empty and the board says: forty-five rows, good luck.
--
-- ── THE SECOND HALF OF THE SAME PROBLEM ─────────────────────────────────────
-- The database already had an outreach machine when this was written:
-- loop_crm_next (who is due), loop_crm_mark (record the send), loop_send_sms
-- and loop_send_email. None of it is in this repository — it was applied
-- straight to the database — and none of it has ever run: across all 45 shops,
-- attempts = 0, last_sent_at is null, channel is null. It is a machine with no
-- hand on it, because nothing a human touches ever calls it.
--
-- Worse, the two halves disagreed about English. loop_crm_mark writes
-- 'contacted', 'demo_sent', 'replied', 'lost', 'skip'; the CRM only knows
-- 'lead', 'pitched', 'warm', 'signed', 'no'. The first time that machine ran,
-- every shop it touched would have dropped out of the board's "Still open" tab,
-- lost its status pill, and stopped being counted — the shops being worked
-- hardest would have been the ones that vanished. Both halves are reconciled
-- here onto the CRM's five words, and a constraint now stops a sixth appearing.
--
-- ── THE RULE, SAME AS THE BOARD'S ───────────────────────────────────────────
-- The run is not a list Nick maintains. Every row in it is there because of
-- something the platform can prove: a chase date that has come round, a signed
-- shop where nobody has ever punched a card, a shop whose cards have gone
-- quiet, a shop pitched a fortnight ago and never rung back. He does not decide
-- what is on the run. He decides what happened when he got there.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- One vocabulary. Five words.
-- ----------------------------------------------------------------------------
update public.loop_crm set status = case status
    when 'contacted' then 'pitched'
    when 'demo_sent' then 'pitched'
    when 'replied'   then 'warm'
    when 'lost'      then 'no'
    when 'skip'      then 'no'
    else status end
 where status not in ('lead','pitched','warm','signed','no');

alter table public.loop_crm drop constraint if exists loop_crm_status_words;
alter table public.loop_crm add constraint loop_crm_status_words
  check (status in ('lead','pitched','warm','signed','no'));

-- loop_crm_mark is called by n8n, not by the page, so it keeps its own dialect
-- at the door and translates on the way in. A word it does not recognise now
-- leaves the status alone instead of writing something the board cannot read.
create or replace function public.loop_crm_mark(
  p_id bigint, p_status text, p_channel text default null,
  p_note text default null, p_followup_days integer default 4)
returns public.loop_crm language plpgsql as $$
declare v_row public.loop_crm; v_in text; v_st text; v_sent boolean;
begin
  v_in := lower(btrim(coalesce(p_status,'')));
  v_st := case v_in
            when 'contacted' then 'pitched' when 'demo_sent' then 'pitched'
            when 'replied'   then 'warm'    when 'lost'      then 'no'
            when 'skip'      then 'no'
            when 'lead' then 'lead' when 'pitched' then 'pitched'
            when 'warm' then 'warm' when 'signed'  then 'signed' when 'no' then 'no'
            else null end;
  v_sent := v_in in ('contacted','demo_sent');

  update public.loop_crm set
    status       = coalesce(v_st, status),
    channel      = coalesce(nullif(btrim(coalesce(p_channel,'')),''), channel),
    note         = coalesce(nullif(btrim(coalesce(p_note,'')),''), note),
    attempts     = case when v_sent then coalesce(attempts,0) + 1 else attempts end,
    last_sent_at = case when v_sent then now() else last_sent_at end,
    replied_at   = case when v_in in ('replied','warm','signed') and replied_at is null
                        then now() else replied_at end,
    next_at      = case when v_sent then current_date + greatest(1, coalesce(p_followup_days,4))
                        when v_in in ('signed','lost','skip','no') then null
                        else next_at end,
    updated_at   = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end $$;

-- loop_crm_next reads the same five words now, and the same attempts counter
-- the page keeps. Left deliberately without SECURITY DEFINER: RLS is on with no
-- policies, so an anon caller gets an empty set and only n8n's service key —
-- which bypasses RLS — sees anything.
create or replace function public.loop_crm_next(p_limit integer default 25, p_channel text default null)
returns setof public.loop_crm language sql stable as $$
  select *
    from public.loop_crm
   where coalesce(status,'lead') in ('lead','pitched','warm')
     and coalesce(attempts,0) < 4
     and (next_at is null or next_at <= current_date)
     and (p_channel is null
          or (p_channel = 'ig'    and instagram is not null)
          or (p_channel = 'sms'   and phone is not null)
          or (p_channel = 'email' and email is not null))
   order by coalesce(score,0) desc, (case when rank > 0 then rank else 99 end) asc,
            coalesce(next_at, created_at::date) asc
   limit greatest(1, least(p_limit, 200));
$$;

-- ----------------------------------------------------------------------------
-- crm_run — the morning's work, in the order it should be done.
--
-- Six reasons a shop earns a place, every one of them a fact the platform holds
-- rather than an intention Nick recorded:
--
--   dead     signed, and not one customer has ever punched a card. The worst
--            thing that can happen to Loop happens quietly: a barber sets it up
--            and it just sits there. Three days' grace, then it is top of the run.
--   quiet    signed, cards were being punched, and now they are not. A shop that
--            stops is a shop about to churn, and nobody would think to look.
--   overdue  a chase date that has already gone past. Worst first.
--   due      a chase date that is today.
--   dropped  pitched a fortnight ago, no chase date, nothing since. This is the
--            hole every list has: not refused, just quietly forgotten.
--   fresh    never touched at all, best-ranked first. Fills the rest of the day
--            so the run is never empty and never an excuse.
--
-- Capped, because a run of forty-five is a run of none.
-- ----------------------------------------------------------------------------
create or replace function public.crm_run(p_key text, p_limit integer default 8)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_rows jsonb; v_tally jsonb; v_lim int := greatest(1, least(coalesce(p_limit,8), 40));
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;

  -- rows and tally come out of one statement on purpose: the tally counts the
  -- whole board while the rows are capped, and computing them separately would
  -- let the two disagree about a shop that changed between the two reads.
  with base as (
    select c.id, c.name, c.town, c.address, c.phone, c.instagram, c.angle,
           c.owner_name, c.email, c.status, c.client, c.note, c.next_at, c.rank,
           coalesce(c.attempts,0) as attempts, c.channel, c.last_sent_at, c.updated_at,
           s.biz_name, s.created_at::date as joined_on,
           (select count(*) from public.reward_members m where m.client = s.client) as members,
           (select count(*) from public.reward_points_ledger g
             where g.client = s.client and g.kind = 'BASE_VISIT') as visits,
           (select max(g.created_at)::date from public.reward_points_ledger g
             where g.client = s.client and g.kind = 'BASE_VISIT') as last_visit,
           (select max(t.at) from public.loop_crm_touch t where t.crm_id = c.id) as last_touch,
           (select count(*) from public.loop_crm_touch t where t.crm_id = c.id) as touches
      from public.loop_crm c
      left join public.reward_settings s on s.client = c.client
     where c.status <> 'no'
  ),
  tagged as (
    select b.*,
      case
        when b.client is not null and b.visits = 0 and b.joined_on <= current_date - 3 then 'dead'
        when b.client is not null and b.visits > 0 and b.last_visit <= current_date - 21 then 'quiet'
        when b.next_at is not null and b.next_at <  current_date then 'overdue'
        when b.next_at is not null and b.next_at =  current_date then 'due'
        when b.status in ('pitched','warm') and b.next_at is null
             and coalesce(b.last_touch, b.last_sent_at, b.updated_at) <= now() - interval '10 days' then 'dropped'
        when b.status = 'lead' and b.touches = 0 and b.attempts = 0 then 'fresh'
        else null end as reason
      from base b
  ),
  picked as (
    select t.*,
           case t.reason when 'dead' then 1 when 'quiet' then 2 when 'overdue' then 3
                         when 'due' then 4 when 'dropped' then 5 else 6 end as prio,
           -- within a reason, the one that has been wrong for longest goes first
           case t.reason
             when 'dead'    then current_date - t.joined_on
             when 'quiet'   then current_date - t.last_visit
             when 'overdue' then current_date - t.next_at
             when 'dropped' then current_date - coalesce(t.last_touch, t.last_sent_at, t.updated_at)::date
             else 0 end as hurt,
           case when t.rank > 0 then t.rank else 99 end as rank_key,
           case when t.phone is not null then 'text'
                when t.instagram is not null then 'dm'
                else 'walk' end as channel_now
      from tagged t
     where t.reason is not null
     order by prio, hurt desc, rank_key, t.name
     limit v_lim
  )
  select
    (select coalesce(jsonb_agg(to_jsonb(p) order by p.prio, p.hurt desc, p.rank_key, p.name), '[]'::jsonb)
       from picked p),
    (select jsonb_build_object(
        'dead',    count(*) filter (where reason = 'dead'),
        'quiet',   count(*) filter (where reason = 'quiet'),
        'overdue', count(*) filter (where reason = 'overdue'),
        'due',     count(*) filter (where reason = 'due'),
        'dropped', count(*) filter (where reason = 'dropped'),
        'fresh',   count(*) filter (where reason = 'fresh'),
        'total',   count(*) filter (where reason is not null))
       from tagged)
    into v_rows, v_tally;

  return jsonb_build_object('ok', true, 'rows', v_rows, 'tally', v_tally);
end $$;

-- ----------------------------------------------------------------------------
-- crm_touch keeps the outreach counters the machine reads. Without this the
-- page and n8n each keep their own idea of how many times a shop has been
-- approached, and loop_crm_next's "stop after four" would count only the ones
-- n8n sent — so a shop Nick had already rung three times would still be first
-- in the queue for a fifth.
-- ----------------------------------------------------------------------------
create or replace function public.crm_touch(
  p_key text, p_id bigint, p_kind text, p_body text default null,
  p_next_at text default null, p_status text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_kind text; v_st text; v_next date; v_out boolean;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  if not exists (select 1 from public.loop_crm where id = p_id) then
    return jsonb_build_object('ok', false, 'error', 'No such shop.');
  end if;
  v_kind := lower(btrim(coalesce(p_kind,'note')));
  if v_kind not in ('call','walk','dm','text','email','note') then v_kind := 'note'; end if;
  v_st := nullif(btrim(coalesce(p_status,'')), '');
  if v_st is not null and v_st not in ('lead','pitched','warm','signed','no') then v_st := null; end if;
  -- a note to self is not an approach; everything else is
  v_out := v_kind in ('call','walk','dm','text','email');

  begin v_next := nullif(btrim(coalesce(p_next_at,'')),'')::date;
  exception when others then v_next := null; end;

  insert into public.loop_crm_touch (crm_id, kind, body)
  values (p_id, v_kind, left(nullif(btrim(coalesce(p_body,'')),''), 2000));

  update public.loop_crm set
    status  = coalesce(v_st,
                case when status = 'lead' and v_out then 'pitched' else status end),
    next_at = case when v_next is not null then v_next
                   when p_next_at = '' then null else next_at end,
    attempts     = case when v_out then coalesce(attempts,0) + 1 else attempts end,
    last_sent_at = case when v_out then now() else last_sent_at end,
    channel      = case when v_out then v_kind else channel end,
    -- warm means he heard back. That is the only thing "they replied" can mean.
    replied_at   = case when coalesce(v_st,'') in ('warm','signed') and replied_at is null
                        then now() else replied_at end,
    updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.crm_run(text,integer) from public, anon, authenticated;
grant  execute on function public.crm_run(text,integer) to anon, authenticated;

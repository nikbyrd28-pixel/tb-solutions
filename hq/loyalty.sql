-- ============================================================================
-- Loop Loyalty — visit-points redemption RPCs
-- ----------------------------------------------------------------------------
-- The visit-points backbone (points -> the real reward) as opposed to coins,
-- which are the arcade currency and live in hq/economy.sql.
--
-- SCOPE OF THIS FILE: it records the two redemption RPCs and the owner
-- dashboard (at the bottom), not the whole loyalty schema. add_visit,
-- join_rewards, spin_wheel and the reward_members / reward_settings tables
-- still live only in the database and in migrations.
--
-- WHY THESE TWO ARE HERE (migration redeem_paths_atomic_balance_check):
-- both read a balance in one statement and spent it in another, with nothing
-- holding the row in between. Two concurrent calls could each clear the check
-- and each grant a reward off the same balance — for redeem_reward that is two
-- free haircuts for one card, and points has no CHECK constraint so the second
-- deduct drove the customer negative and ate their progress toward the next
-- real reward. The spend now carries its own eligibility predicate, so the
-- losing call updates zero rows and gets the ordinary refusal. Behaviour for a
-- single call is unchanged. Same fix as coin_redeem in hq/economy.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Staff-gated redemption of the shop's headline reward. Costs reward_at points.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_reward(p_code text, p_pin text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client = m.client;
  if s.pin is distinct from p_pin then return jsonb_build_object('error','wrong PIN'); end if;
  if m.points < s.reward_at then return jsonb_build_object('error','not enough points yet'); end if;
  update public.reward_members set points = points - s.reward_at, redeemed = redeemed + 1
    where id = m.id and points >= s.reward_at   -- atomic: the racing second call fails here
    returning * into m;
  if m.id is null then return jsonb_build_object('error','not enough points yet'); end if;
  return (to_jsonb(m) - 'phone') || jsonb_build_object('reward_at', s.reward_at, 'reward_text', s.reward_text, 'redeemed_now', true);
end $$;

-- ----------------------------------------------------------------------------
-- Customer-claimed "every Nth cut" milestone. Not PIN-gated — the customer taps
-- it on their own card and shows the prize at the counter — so the eligibility
-- maths is the only thing standing between them and an unearned reward.
-- Eligibility is lifetime/cuts minus what they have already claimed, which lets
-- someone who crossed several milestones between visits claim each one.
-- ----------------------------------------------------------------------------
create or replace function public.claim_milestone(p_code text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; mil jsonb; cuts int; eligible int; lt int;
begin
  select * into m from public.reward_members where code=p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client=m.client;
  mil := s.milestone;
  if mil is null or coalesce((mil->>'on')::boolean,false)=false then return jsonb_build_object('error','No milestone set.'); end if;
  cuts := greatest(1, coalesce((mil->>'cuts')::int,8));
  lt := coalesce(m.lifetime, m.points, 0);
  eligible := floor(lt::numeric/cuts)::int - coalesce(m.milestone_claims,0);
  if eligible < 1 then return jsonb_build_object('error','Not unlocked yet — keep visiting!'); end if;
  update public.reward_members
    set milestone_claims = coalesce(milestone_claims,0)+1,
        prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'label', coalesce(mil->>'label','Milestone reward'), 'icon', coalesce(nullif(mil->>'icon',''),'🏆'), 'won_at', now(), 'milestone', true))
    where id=m.id
      and floor(coalesce(lifetime, points, 0)::numeric/cuts)::int - coalesce(milestone_claims,0) >= 1  -- atomic
    returning * into m;
  if m.id is null then return jsonb_build_object('error','Not unlocked yet — keep visiting!'); end if;
  return (to_jsonb(m) - 'phone') || jsonb_build_object('milestone_claimed', true,
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', coalesce(s.spin_cost,2),
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p));
end $$;

grant execute on function public.redeem_reward(text, text) to anon, authenticated;
grant execute on function public.claim_milestone(text)     to anon, authenticated;

-- ----------------------------------------------------------------------------
-- STILL OPEN, deliberately not fixed here:
--   coin_spin (hq/economy.sql) has the same read-then-deduct gap on spin_cost.
--   It has follow-on updates to spins / prizes / lottery_wins that make the
--   rewrite riskier, so it wants doing on its own with its own probe.
--   lottery_draw has not been reviewed for this yet.
-- add_visit is additive and PIN-gated, so there is no balance to race; its
-- double-tap exposure is handled client-side in rewards/staff/, which has both
-- an in-flight guard and a 3-minute repeat-punch confirm.
--
-- REACHABILITY, so nobody over-reads the fix: neither race is reachable by
-- double-tapping the UI. The only live redeem_reward caller is rewards/staff/
-- (writeOnce guard) and claim_milestone's button disables itself before the
-- call. What these predicates close is genuine concurrency — two devices on
-- one card, or a replayed request — which nothing else was guarding.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Owner dashboard
-- ----------------------------------------------------------------------------
-- Was not recorded anywhere in the repo before; this is the live definition.
--
-- v2 (migration owner_dashboard_bookings_from_source_of_truth): the Bookings
-- tile and the recent-bookings list both read client_leads, which is only a
-- best-effort MIRROR of reward_appointments — the insert in book_appointment is
-- wrapped in `exception when others then null`, so any failure silently drops a
-- booking from the owner's count, and appointments created by any other path
-- never appeared at all. Demo showed it plainly: 7 real appointments, all
-- confirmed, reported to the owner as 5.
--
-- It also counted the wrong things. A kind='booking' lead can be a booking
-- REQUEST from the older lead form ('Rewards member wants to book: Tuesday 3')
-- rather than an actual appointment, so the tile mixed enquiries in while
-- missing real bookings.
--
-- Both now read reward_appointments, so the tile agrees with the agenda in
-- booking_admin. recent_bookings keeps its shape (who / message / status /
-- created_at) but builds the message from the real service, barber and start
-- time, and reports the real appointment status. Added bookings_upcoming, which
-- is the number an owner actually acts on.
--
-- The paired client fix is in rewards/owner/: the page stripped the message
-- with /^📅[^:]*:\s*/, which runs to the FIRST colon — and in a real booking
-- that colon is inside the time, so "📅 Haircut with Marco — Fri Jul 24,
-- 11:45 AM" reached the owner as "45 AM". Every booking made through the card
-- was unreadable on the dashboard.
--
-- STILL IMPERFECT, needs a schema change rather than a patch: 'reviews' counts
-- by matching lower(business) against the shop's biz_name, because the reviews
-- table has no client column. Rename the business and the review count drops to
-- zero. Worth giving reviews a client column when someone is next in there.
-- ============================================================================
create or replace function public.loyalty_owner_dashboard(p_client text, p_pin text)
returns json language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; v json; tz text; bname text;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,'')) limit 1;
  if s.client is null then return json_build_object('ok', false, 'error', 'No loyalty program with that code.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return json_build_object('ok', false, 'error', 'Wrong PIN — that''s your staff PIN.');
  end if;
  tz := coalesce(s.book_tz,'America/New_York');
  bname := coalesce(nullif(s.biz_name,''), s.client);
  select json_build_object(
    'ok', true, 'client', s.client, 'biz_name', nullif(btrim(coalesce(s.biz_name,'')),''),
    'reward_text', coalesce(s.reward_text,'a reward'), 'reward_at', coalesce(s.reward_at,5),
    'members', (select count(*) from reward_members where client=s.client),
    'active30', (select count(*) from reward_members where client=s.client and last_visit_at > now()-interval '30 days'),
    'new7', (select count(*) from reward_members where client=s.client and created_at > now()-interval '7 days'),
    'points_out', (select coalesce(sum(points),0) from reward_members where client=s.client),
    'lifetime_out', (select coalesce(sum(lifetime),0) from reward_members where client=s.client),
    'redeemed', (select coalesce(sum(redeemed),0) from reward_members where client=s.client),
    'spins', (select coalesce(sum(spins),0) from reward_members where client=s.client),
    'prizes', (select coalesce(sum(jsonb_array_length(coalesce(prizes,'[]'::jsonb))),0) from reward_members where client=s.client),
    -- from reward_appointments, not the client_leads mirror
    'bookings', (select count(*) from reward_appointments where client=s.client),
    'bookings_upcoming', (select count(*) from reward_appointments
                           where client=s.client and status='confirmed' and start_at > now()),
    -- by slug, with the old name match kept for legacy rows that have no client
    'reviews', (select count(*) from reviews
                 where (client = s.client or (client is null and lower(business)=lower(bname)))),
    'tiers', json_build_object(
       'bronze', (select count(*) from reward_members where client=s.client and lifetime < 25),
       'silver', (select count(*) from reward_members where client=s.client and lifetime >= 25 and lifetime < 75),
       'gold',   (select count(*) from reward_members where client=s.client and lifetime >= 75 and lifetime < 200),
       'vip',    (select count(*) from reward_members where client=s.client and lifetime >= 200)),
    'top', (select coalesce(json_agg(t),'[]'::json) from (
       select name, lifetime, points, coalesce(streak,0) as streak, (1+floor(lifetime/10.0))::int as level
       from reward_members where client=s.client order by lifetime desc nulls last, points desc limit 10) t),
    'recent_bookings', (select coalesce(json_agg(b),'[]'::json) from (
       select coalesce(nullif(a.name,''),'A member') as who,
              '📅 ' || coalesce(nullif(a.service->>'name',''),'Appointment')
                    || coalesce(' with '||nullif(a.staff_name,''),'')
                    || ' — ' || to_char(a.start_at at time zone tz, 'Dy Mon DD, HH12:MI AM') as message,
              case a.status when 'confirmed' then 'Confirmed' when 'cancelled' then 'Cancelled'
                            when 'done' then 'Done' when 'noshow' then 'No-show'
                            else initcap(coalesce(a.status,'')) end as status,
              a.created_at
       from reward_appointments a where a.client=s.client
       order by a.created_at desc limit 15) b),
    'recent_feedback', (select coalesce(json_agg(fb),'[]'::json) from (
       select coalesce(nullif(name,''),'A customer') as who, rating, text, created_at
       from review_feedback where client=s.client order by created_at desc limit 15) fb)
  ) into v;
  return v;
end $$;

grant execute on function public.loyalty_owner_dashboard(text,text) to anon, authenticated;

-- The tier thresholds above (25 / 75 / 200) must stay in step with crm_members'
-- tier label and with RANKS in rewards/index.html, and the level formula
-- (1+floor(lifetime/10)) with XP_PER_LEVEL there. Checked in step as of this
-- commit — if you move one, move all three.

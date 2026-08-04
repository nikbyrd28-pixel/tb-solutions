-- ============================================================================
-- Loop Loyalty — visit-points redemption RPCs
-- ----------------------------------------------------------------------------
-- The visit-points backbone (points -> the real reward) as opposed to coins,
-- which are the arcade currency and live in hq/economy.sql.
--
-- SCOPE OF THIS FILE: it records the two redemption RPCs, not the whole
-- loyalty schema. add_visit, join_rewards, spin_wheel and the reward_members /
-- reward_settings tables still live only in the database and in migrations.
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

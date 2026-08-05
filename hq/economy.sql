-- ============================================================================
-- Loop Coin Economy + Arcade
-- ----------------------------------------------------------------------------
-- Coins are earned ONLY three ways: playing an arcade game, booking an
-- appointment, or referring a friend who joins. Coins are the arcade currency
-- and the slot-machine spend. Visit-points stay the loyalty backbone (progress
-- to the real reward). Everything is server-authoritative and daily-capped so
-- the game can't be farmed. All additive / backward-compatible.
-- ============================================================================

alter table public.reward_members add column if not exists coins       integer default 0;
alter table public.reward_members add column if not exists games       jsonb   default '{}'::jsonb;  -- {flyer:highscore, hopper:highscore}
alter table public.reward_members add column if not exists coins_day   date;
alter table public.reward_members add column if not exists coins_today integer default 0;
update public.reward_members set coins = 0 where coins is null;

-- Coins per game are capped per play AND per day; amounts scale with the shop's
-- game_difficulty (easy=generous, normal=balanced, hard=stingy).
create or replace function public.game_reward(p_code text, p_game text, p_score integer)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  m public.reward_members; s public.reward_settings;
  diff text; tz text; today date; cap int; perplay int; earned int; allowed int; grantc int;
  g jsonb; hs int; game text; sc int;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client = m.client;
  tz := coalesce(s.book_tz,'America/New_York');
  diff := coalesce(s.game_difficulty,'normal');
  game := lower(coalesce(p_game,'')); if game not in ('flyer','hopper') then game := 'flyer'; end if;
  sc := greatest(0, least(1000, coalesce(p_score,0)));
  cap     := case diff when 'easy' then 60 when 'hard' then 18 else 35 end;
  perplay := case diff when 'easy' then 15 when 'hard' then 6  else 10 end;
  today := (now() at time zone tz)::date;
  if m.coins_day is distinct from today then m.coins_today := 0; m.coins_day := today; end if;
  earned  := least(perplay, floor(sc/3.0)::int);
  allowed := greatest(0, cap - coalesce(m.coins_today,0));
  grantc  := least(earned, allowed);
  g := coalesce(m.games,'{}'::jsonb);
  hs := coalesce((g->>game)::int,0);
  if sc > hs then g := g || jsonb_build_object(game, sc); hs := sc; end if;
  update public.reward_members
    set coins = coalesce(coins,0)+grantc, coins_today = coalesce(m.coins_today,0)+grantc, coins_day = today, games = g
    where id = m.id returning * into m;
  return (to_jsonb(m) - 'phone') || jsonb_build_object(
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', coalesce(s.spin_cost,2),
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p),
    'coins_earned', grantc, 'daily_cap', cap, 'game_high', hs, 'capped', (grantc < earned));
end $$;

-- Slot machine spends COINS (not visit-points). Same weighted-odds logic as
-- spin_wheel; grand/discount/prize wins all become claimable prizes.
--
-- v2 (applied via migration arcade_spend_atomic_balance_check): the charge had
-- no predicate, so a racing second spin deducted twice AND — because the prize
-- is awarded by a separate update further down — awarded twice, leaving the
-- balance negative. The charge now carries `coins >= cost` and bails out if it
-- updates no rows. Nothing is written before that point, so bailing just
-- discards the draw. The follow-on updates key off v_id rather than m.id,
-- which the guarded RETURNING would leave null on the losing call.
create or replace function public.coin_spin(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  m public.reward_members; s public.reward_settings; v_id public.reward_members.id%type;
  total int; r numeric; acc int := 0; pick jsonb; idx int := -1; i int := 0;
  won_label text; won_type text; won_val text; cost int; pts int;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  v_id := m.id;
  select * into s from public.reward_settings where client = m.client;
  cost := coalesce(s.spin_cost,2);
  if coalesce(m.coins,0) < cost then
    return jsonb_build_object('error','Not enough coins — play a game, book, or refer a friend to earn coins.');
  end if;
  select coalesce(sum((p->>'weight')::int),0) into total from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p;
  if total <= 0 then return jsonb_build_object('error','Prize game not set up yet.'); end if;
  r := random() * total;
  for pick in select * from jsonb_array_elements(s.spin_prizes) loop
    acc := acc + (pick->>'weight')::int;
    if r < acc then idx := i; exit; end if;
    i := i + 1;
  end loop;
  if idx = -1 then idx := 0; select p into pick from jsonb_array_elements(s.spin_prizes) p limit 1; end if;
  won_label := pick->>'label'; won_type := pick->>'type'; won_val := pick->>'value';
  -- Charge first, atomically. The prize is awarded by a SEPARATE update below,
  -- so a racing second call that got past the check above must be stopped HERE
  -- or it deducts twice and awards twice. Nothing has been written yet at this
  -- point, so bailing out just discards the draw.
  update public.reward_members
    set coins = coalesce(coins,0) - cost, spins = coalesce(spins,0) + 1
    where id = v_id and coalesce(coins,0) >= cost
    returning * into m;
  if m.id is null then
    return jsonb_build_object('error','Not enough coins — play a game, book, or refer a friend to earn coins.');
  end if;
  if won_type = 'points' then
    pts := coalesce(nullif(won_val,'')::int, nullif(regexp_replace(coalesce(won_label,''),'[^0-9]','','g'),'')::int, 1);
    update public.reward_members set points = points + pts, lifetime = lifetime + pts where id = v_id;
  elsif won_type in ('prize','grand','discount') then
    update public.reward_members
      set prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'label', case when coalesce(won_val,'')<>'' then won_val
                      when won_type='grand' and coalesce(won_label,'')='' then s.reward_text
                      else won_label end,
        'won_at', now()))
      where id = v_id;
  end if;
  select * into m from public.reward_members where id = v_id;
  return (to_jsonb(m) - 'phone') || jsonb_build_object(
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', cost,
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p),
    'result', jsonb_build_object('label', won_label, 'type', won_type, 'index', idx));
end $$;

-- ----------------------------------------------------------------------------
-- Long-odds jackpot ticket. Also spends coins, one statement, win and charge
-- together. Same v2 fix as coin_spin (migration arcade_spend_atomic_balance_check):
-- the charge had no predicate, so a racing second ticket went negative.
-- ----------------------------------------------------------------------------
create or replace function public.lottery_draw(p_code text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; lot jsonb; cost int; odds int; won boolean;
begin
  select * into m from public.reward_members where code=p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client=m.client;
  lot := s.lottery;
  if lot is null or coalesce((lot->>'on')::boolean,false)=false then return jsonb_build_object('error','Lottery is off.'); end if;
  cost := greatest(1, coalesce((lot->>'cost')::int,10));
  odds := greatest(2, coalesce((lot->>'odds')::int,100));
  if coalesce(m.coins,0) < cost then return jsonb_build_object('error','Not enough coins — play the arcade to earn tickets!'); end if;
  won := random() < (1.0/odds);
  update public.reward_members set coins = coalesce(coins,0) - cost,
     lottery_wins = coalesce(lottery_wins,0) + (case when won then 1 else 0 end),
     prizes = case when won then coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'label', coalesce(lot->>'jackpot','Jackpot!'), 'icon', coalesce(nullif(lot->>'icon',''),'🎰'), 'won_at', now(), 'lottery', true)) else coalesce(prizes,'[]'::jsonb) end
     where id=m.id and coalesce(coins,0) >= cost   -- atomic: the racing second ticket fails here
     returning * into m;
  if m.id is null then return jsonb_build_object('error','Not enough coins — play the arcade to earn tickets!'); end if;
  return (to_jsonb(m) - 'phone') || jsonb_build_object('lottery_result', (case when won then 'win' else 'lose' end),
     'jackpot', lot->>'jackpot', 'odds', odds, 'cost', cost,
     'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', coalesce(s.spin_cost,2),
     'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p));
end $$;

grant execute on function public.game_reward(text, text, integer) to anon, authenticated;
grant execute on function public.coin_spin(text)                  to anon, authenticated;
grant execute on function public.lottery_draw(text)               to anon, authenticated;

-- NOTE: book_appointment (awards booking coins) and join_rewards (credits a
-- referrer with coins when their friend joins) are defined in hq/booking.sql /
-- applied via migrations loop_coin_awards_book_refer. Coins earned:
--   play  -> game_reward (per-play + daily cap by difficulty)
--   book  -> book_appointment (+12 / +8 / +5)
--   refer -> join_rewards    (+15 / +10 / +6 to the referrer)

-- v2 (applied via migration loop_daily_bonus): game_reward now accepts any game
-- key (fixes runner/slicer/stacker scores clobbering flyer's), and grants a
-- first-play-of-the-day bonus (+8/+5/+3 by difficulty) outside the daily cap,
-- returned as 'daily_bonus' and included in 'coins_earned'.

-- ----------------------------------------------------------------------------
-- Coin store redemption. Prices come from the shop's coin_store server-side by
-- item_id — the client never sends a price. Stock, per_customer and barber
-- scope are all enforced here.
--
-- v2 (applied via migration coin_redeem_atomic_balance_check): the balance was
-- read in one statement and deducted in another, so two concurrent calls could
-- both pass the check and spend the same coins twice. The deduct now carries
-- its own `coins >= price` predicate, so the losing call updates zero rows and
-- is refused. Behaviour for a single call is unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.coin_redeem(p_code text, p_item_id text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; item jsonb; found jsonb := null;
  price int; stk int; pc int; sold int; mine int; ibarber text; lbl text; icon text;
begin
  select * into m from public.reward_members where code=p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client=m.client;
  for item in select * from jsonb_array_elements(coalesce(s.coin_store,'[]'::jsonb)) loop
    if coalesce(item->>'id','')=p_item_id then found:=item; exit; end if;
  end loop;
  if found is null then return jsonb_build_object('error','That reward is no longer available.'); end if;
  ibarber := coalesce(found->>'barber','');
  if ibarber<>'' and ibarber<>coalesce(m.barber,'') then return jsonb_build_object('error','That reward is for a different chair.'); end if;
  price := coalesce(nullif(found->>'sale','')::int, (found->>'cost')::int);
  stk := nullif(found->>'stock','')::int;
  if stk is not null then
    sold := (select count(*) from public.store_redemptions where client=m.client and item_id=p_item_id);
    if sold >= stk then return jsonb_build_object('error','Sold out — check back soon!'); end if;
  end if;
  pc := nullif(found->>'per_customer','')::int;
  if pc is not null then
    mine := (select count(*) from public.store_redemptions where client=m.client and item_id=p_item_id and code=p_code);
    if mine >= pc then return jsonb_build_object('error','You already claimed this one.'); end if;
  end if;
  if coalesce(m.coins,0) < price then return jsonb_build_object('error','Not enough coins yet — keep playing!'); end if;
  lbl := found->>'label'; icon := coalesce(nullif(found->>'icon',''),'🎁');
  update public.reward_members
    set coins = coins - price,
        prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('label',lbl,'icon',icon,'won_at',now(),'coins',price))
    where id=m.id and coalesce(coins,0) >= price   -- atomic: the racing second call fails here
    returning * into m;
  if m.id is null then return jsonb_build_object('error','Not enough coins yet — keep playing!'); end if;
  insert into public.store_redemptions(client,item_id,code) values (m.client, p_item_id, p_code);
  return (to_jsonb(m) - 'phone') || jsonb_build_object('redeemed_label', lbl,
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', coalesce(s.spin_cost,2),
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p));
end $$;

grant execute on function public.coin_redeem(text, text) to anon, authenticated;

-- Every coin spend in the arcade (coin_redeem, coin_spin, lottery_draw) now
-- charges under its own balance predicate. The visit-points equivalents are in
-- hq/loyalty.sql. Earning is capped in game_reward above; book_appointment and
-- join_rewards award coins and have not been reviewed for this.

-- ----------------------------------------------------------------------------
-- Free daily spin. Costs nothing — the once-a-day limit is the whole economy.
-- Was not recorded anywhere in the repo before; this is the live definition.
--
-- v2 (migration daily_spin_points_parse_and_atomic_claim). Three faults:
--
-- 1. IT CRASHED. The owner UI writes a points prize as
--    {"type":"points","label":"+2 points","weight":18} with NO value key, and
--    all nine live shops have one. This did `points = points + (won_val)::int`
--    with won_val NULL, so points went NULL and violated the NOT NULL column,
--    aborting the call. On demo that wedge is weight 18 of 107 — about one free
--    spin in six died with a database error. coin_spin above has always parsed
--    this correctly (explicit value, else digits in the label, else 1); this
--    one never did, and now matches it.
-- 2. IT COULD BE RE-ROLLED. The crash aborted the transaction, so
--    last_daily_spin rolled back with it and the customer could just spin
--    again — and keep spinning until they missed the points wedge, quietly
--    skewing the wheel toward the real prizes. Fixing the crash removes that,
--    and the claim is atomic now too, so two concurrent calls cannot both take
--    the day's spin.
-- 3. THE DAY ENDED AT THE WRONG TIME. current_date is the server's UTC date,
--    which rolls over at 8pm in America/New_York — "come back tomorrow for a
--    free spin" actually meant "come back this evening", every evening. Keyed
--    to the shop's own timezone now.
--
-- Anyone touching the wheel: the value key is optional and usually absent.
-- Parse it the way coin_spin and daily_spin do, never with a bare cast.
-- ----------------------------------------------------------------------------
create or replace function public.daily_spin(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings; v_id public.reward_members.id%type;
        total int; r numeric; acc int := 0; pick jsonb; idx int := -1; i int := 0;
        won_label text; won_type text; won_val text; pts int; today_local date;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  v_id := m.id;
  select * into s from public.reward_settings where client = m.client;
  today_local := (now() at time zone coalesce(s.book_tz,'America/New_York'))::date;
  if m.last_daily_spin = today_local then
    return jsonb_build_object('already', true, 'error','Already claimed today — come back tomorrow for a free spin!');
  end if;
  select coalesce(sum((p->>'weight')::int),0) into total from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p;
  if total <= 0 then return jsonb_build_object('error','wheel not configured'); end if;
  r := random() * total;
  for pick in select * from jsonb_array_elements(s.spin_prizes) loop
    acc := acc + (pick->>'weight')::int;
    if r < acc then idx := i; exit; end if;
    i := i + 1;
  end loop;
  if idx = -1 then idx := 0; select p into pick from jsonb_array_elements(s.spin_prizes) p limit 1; end if;
  won_label := pick->>'label'; won_type := pick->>'type'; won_val := pick->>'value';

  -- Claim the day atomically. Nothing has been written yet, so a racing second
  -- call that loses here simply discards its draw.
  update public.reward_members
     set last_daily_spin = today_local, spins = coalesce(spins,0) + 1
   where id = v_id and last_daily_spin is distinct from today_local
  returning * into m;
  if m.id is null then
    return jsonb_build_object('already', true, 'error','Already claimed today — come back tomorrow for a free spin!');
  end if;

  if won_type = 'points' then
    -- same parse as coin_spin: explicit value, else the digits in the label, else 1
    pts := coalesce(nullif(won_val,'')::int,
                    nullif(regexp_replace(coalesce(won_label,''),'[^0-9]','','g'),'')::int, 1);
    update public.reward_members set points = points + pts, lifetime = lifetime + pts where id = v_id;
  elsif won_type = 'prize' then
    update public.reward_members
      set prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'label', case when coalesce(won_val,'')='' then s.reward_text else won_val end, 'won_at', now()))
      where id = v_id;
  end if;
  select * into m from public.reward_members where id = v_id;
  return (to_jsonb(m) - 'phone') || jsonb_build_object(
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', s.spin_cost, 'daily', true,
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p),
    'result', jsonb_build_object('label', won_label, 'type', won_type, 'index', idx));
end $$;

grant execute on function public.daily_spin(text) to anon, authenticated;

-- (The submit_survey review-key mismatch noted here has since been fixed —
--  see hq/reviews.sql. Reviews are keyed on the shop slug now, not the
--  free-text business name.)

-- ----------------------------------------------------------------------------
-- spin_wheel — the ORIGINAL points wheel, superseded by coin_spin above.
-- Was not recorded anywhere in the repo before; this is the live definition.
--
-- Nothing in the repo calls it and no other function does, so it is effectively
-- retired — but it is still granted to anon, which means it remains a live API
-- endpoint any member code can POST to. It is kept and fixed rather than
-- revoked because "nothing in the repo calls it" is not the same as "nothing
-- calls it" (a cached page or a saved link would break), and because leaving it
-- as the one unfixed sibling is how these bugs come back if the points wheel is
-- ever switched on again.
--
-- v2 (migration spin_wheel_match_coin_spin_safety) fixed both defects its
-- siblings had already had fixed:
--   1. `points + (won_val)::int` bare-cast the prize's OPTIONAL value key,
--      which is absent on every shop's points wedge, so points went NULL and
--      the NOT NULL column aborted the call — the daily_spin crash exactly.
--   2. It checked the balance and then charged in a separate unguarded
--      statement, so a racing second spin could drive points negative — the
--      read-then-charge gap closed in coin_spin, coin_redeem, redeem_reward,
--      claim_milestone and lottery_draw.
-- ----------------------------------------------------------------------------
create or replace function public.spin_wheel(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare m public.reward_members; s public.reward_settings;
        total int; r numeric; acc int := 0; pick jsonb; idx int := -1; i int := 0;
        won_label text; won_type text; won_val text; pts int; v_id public.reward_members.id%type;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  select * into s from public.reward_settings where client = m.client;
  if m.points < s.spin_cost then return jsonb_build_object('error','Not enough points — you need '||s.spin_cost||' to spin'); end if;

  select coalesce(sum((p->>'weight')::int),0) into total from jsonb_array_elements(s.spin_prizes) p;
  if total <= 0 then return jsonb_build_object('error','wheel not configured'); end if;
  r := random() * total;
  for pick in select * from jsonb_array_elements(s.spin_prizes) loop
    acc := acc + (pick->>'weight')::int;
    if r < acc then idx := i; exit; end if;
    i := i + 1;
  end loop;
  if idx = -1 then idx := 0; select p into pick from jsonb_array_elements(s.spin_prizes) p limit 1; end if;

  won_label := pick->>'label'; won_type := pick->>'type'; won_val := pick->>'value';
  v_id := m.id;
  -- charge atomically: the prize is awarded by a SEPARATE update below, so a
  -- racing second spin must be stopped here or it charges twice and awards twice
  update public.reward_members set points = points - coalesce(s.spin_cost,2), spins = coalesce(spins,0) + 1
    where id = v_id and points >= coalesce(s.spin_cost,2)
    returning * into m;
  if m.id is null then return jsonb_build_object('error','Not enough points — you need '||coalesce(s.spin_cost,2)||' to spin'); end if;
  if won_type = 'points' then
    -- same parse as coin_spin: explicit value, else the digits in the label, else 1
    pts := coalesce(nullif(won_val,'')::int, nullif(regexp_replace(coalesce(won_label,''),'[^0-9]','','g'),'')::int, 1);
    update public.reward_members set points = points + pts, lifetime = lifetime + pts where id = v_id;
  elsif won_type = 'prize' then
    update public.reward_members
      set prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('label', case when coalesce(won_val,'')='' then s.reward_text else won_val end, 'won_at', now()))
      where id = v_id;
  end if;
  select * into m from public.reward_members where id = v_id;
  return (to_jsonb(m) - 'phone') || jsonb_build_object(
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', s.spin_cost,
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(s.spin_prizes) p),
    'result', jsonb_build_object('label', won_label, 'type', won_type, 'index', idx));
end $$;

grant execute on function public.spin_wheel(text) to anon, authenticated;

-- Every wheel in the system now parses the points value the same way and
-- charges under its own predicate: coin_spin, daily_spin, spin_wheel,
-- lottery_draw. The `value` key is OPTIONAL and usually ABSENT — never cast it
-- bare.

-- ============================================================================
-- Casino — blackjack (/arcade/blackjack/) and video poker (/arcade/poker/)
-- ----------------------------------------------------------------------------
-- Not previously recorded anywhere. Both are live, anon-callable, and both take
-- a COIN BET and pay coins back, which makes them the only places in the
-- product other than game_reward where coins are CREATED.
--
-- Tables: bj_games (status 'playing' -> 'done'), vp_games ('dealt' -> 'done').
-- Flow: bj_deal / vp_deal charge the bet and store the shuffled deck server
-- side; bj_hit draws; bj_stand / vp_draw settle and pay.
--
-- THE BUG (migration casino_payout_claim_hand_before_paying)
-- bj_stand and vp_draw credited the payout and THEN marked the hand done, with
-- nothing serialising the two and no predicate on the status update. Two
-- concurrent calls both found the same hand still open, both computed the same
-- payout from the STORED deck (so the result is identical, not a re-roll), and
-- both credited it. Coins minted straight out of one hand. Demonstrated by
-- replaying the interleaving: 100 coins became 140 on a single 10-coin win.
--
-- The order is now reversed — claim the hand by transitioning its status under
-- a predicate, and pay only if that claim actually took the row. The losing
-- call takes nothing and pays nothing. Same shape as every other fix in this
-- economy, just on the CREDIT side rather than the charge side.
--
-- CHECKED CLEAN in the same pass: bj_deal and vp_deal both clamp the bet with
-- greatest(...least(...p_bet,1)), so a negative or absurd bet cannot mint coins
-- at deal time, and both refuse when the balance is short.
--
-- KNOWN, NOT FIXED: bj_hit has no such guard, but it only draws a card and can
-- bust — it never credits, so the worst a race does there is deal the same card
-- twice. Worth tidying if anyone is in the file, not worth a migration on its
-- own.
--
-- ANYONE ADDING A GAME: the payout is the guarded step. Claim the hand first,
-- pay second, and never credit before the status transition.
-- ============================================================================

-- The two payout paths, as fixed. Re-runnable: no-ops if already guarded.
do $mig$
declare def text; src_before text; src_after text; o oid; changed int := 0;
  bj_old text; bj_new text; vp_old text; vp_new text;
begin
  bj_old :=
    '  if payout > 0 then update public.reward_members set coins = coins + payout where id = m.id; end if;' || chr(10) ||
    '  update public.bj_games set dealer = dl, deck = dk, status = ''done'', result = res where id = gme.id;';
  bj_new :=
    '  -- claim the hand FIRST: a racing second call finds no ''playing'' row, so it' || chr(10) ||
    '  -- takes nothing and pays nothing' || chr(10) ||
    '  update public.bj_games set dealer = dl, deck = dk, status = ''done'', result = res' || chr(10) ||
    '    where id = gme.id and status = ''playing'';' || chr(10) ||
    '  if not found then return jsonb_build_object(''error'',''That hand is already finished.''); end if;' || chr(10) ||
    '  if payout > 0 then update public.reward_members set coins = coins + payout where id = m.id; end if;';

  vp_old :=
    '  if payout > 0 then update public.reward_members set coins = coins + payout where id = m.id; end if;' || chr(10) ||
    '  update public.vp_games set hand = nh, status = ''done'', result = rk where id = gme.id;';
  vp_new :=
    '  -- claim the hand FIRST: a racing second call finds no ''dealt'' row, so it' || chr(10) ||
    '  -- takes nothing and pays nothing' || chr(10) ||
    '  update public.vp_games set hand = nh, status = ''done'', result = rk' || chr(10) ||
    '    where id = gme.id and status = ''dealt'';' || chr(10) ||
    '  if not found then return jsonb_build_object(''error'',''That hand is already finished.''); end if;' || chr(10) ||
    '  if payout > 0 then update public.reward_members set coins = coins + payout where id = m.id; end if;';

  select p.oid into o from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='bj_stand';
  select prosrc into src_before from pg_proc where oid=o;
  if src_before !~ 'already finished' then
    if position(bj_old in src_before) = 0 then raise exception 'ABORT: bj_stand payout block not found verbatim'; end if;
    def := replace(pg_get_functiondef(o), bj_old, bj_new);
    execute def;
    select prosrc into src_after from pg_proc where oid=o;
    if replace(src_after, bj_new, bj_old) <> src_before then raise exception 'ABORT: bj_stand changed beyond the payout block'; end if;
    changed := changed + 1;
  end if;

  select p.oid into o from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='vp_draw';
  select prosrc into src_before from pg_proc where oid=o;
  if src_before !~ 'already finished' then
    if position(vp_old in src_before) = 0 then raise exception 'ABORT: vp_draw payout block not found verbatim'; end if;
    def := replace(pg_get_functiondef(o), vp_old, vp_new);
    execute def;
    select prosrc into src_after from pg_proc where oid=o;
    if replace(src_after, vp_new, vp_old) <> src_before then raise exception 'ABORT: vp_draw changed beyond the payout block'; end if;
    changed := changed + 1;
  end if;

  raise notice 'guarded % payout paths', changed;
end $mig$;

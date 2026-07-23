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
create or replace function public.coin_spin(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  m public.reward_members; s public.reward_settings;
  total int; r numeric; acc int := 0; pick jsonb; idx int := -1; i int := 0;
  won_label text; won_type text; won_val text; cost int; pts int;
begin
  select * into m from public.reward_members where code = p_code limit 1;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
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
  update public.reward_members set coins = coins - cost, spins = coalesce(spins,0) + 1 where id = m.id;
  if won_type = 'points' then
    pts := coalesce(nullif(won_val,'')::int, nullif(regexp_replace(coalesce(won_label,''),'[^0-9]','','g'),'')::int, 1);
    update public.reward_members set points = points + pts, lifetime = lifetime + pts where id = m.id;
  elsif won_type in ('prize','grand','discount') then
    update public.reward_members
      set prizes = coalesce(prizes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'label', case when coalesce(won_val,'')<>'' then won_val
                      when won_type='grand' and coalesce(won_label,'')='' then s.reward_text
                      else won_label end,
        'won_at', now()))
      where id = m.id;
  end if;
  select * into m from public.reward_members where id = m.id;
  return (to_jsonb(m) - 'phone') || jsonb_build_object(
    'reward_at', s.reward_at, 'reward_text', s.reward_text, 'spin_cost', cost,
    'wheel', (select coalesce(jsonb_agg(p->>'label'),'[]'::jsonb) from jsonb_array_elements(coalesce(s.spin_prizes,'[]'::jsonb)) p),
    'result', jsonb_build_object('label', won_label, 'type', won_type, 'index', idx));
end $$;

grant execute on function public.game_reward(text, text, integer) to anon, authenticated;
grant execute on function public.coin_spin(text)                  to anon, authenticated;

-- NOTE: book_appointment (awards booking coins) and join_rewards (credits a
-- referrer with coins when their friend joins) are defined in hq/booking.sql /
-- applied via migrations loop_coin_awards_book_refer. Coins earned:
--   play  -> game_reward (per-play + daily cap by difficulty)
--   book  -> book_appointment (+12 / +8 / +5)
--   refer -> join_rewards    (+15 / +10 / +6 to the referrer)

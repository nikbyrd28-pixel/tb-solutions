-- ============================================================================
-- RESELLING LOOP
-- ----------------------------------------------------------------------------
-- The affiliate table already in this database pays a commission for sending a
-- shop our way. This is the opposite arrangement and much more valuable to the
-- person doing it: the reseller owns the client, sets their own price, bills
-- the shop themselves, and uses Loop as the thing they deliver. We never meet
-- their client and never touch their money.
--
-- WHY THAT IS THE RIGHT DEAL TO OFFER.
-- A student who earns 20% of a $50 subscription has a hobby. A student who
-- charges a shop $300 a month and delivers loyalty with software that costs
-- them nothing has a business — and a business will go and find forty shops,
-- which an affiliate link never does.
--
-- WHAT THIS ADDS: proof of who set up which shop, the price they charge, and
-- one honest view of their book. That last part is the whole point. A reseller
-- who can see "6 shops, 940 members, $1,800 a month" behaves like an owner. A
-- reseller with no dashboard forgets which shops are even theirs.
--
-- CLAIMING REQUIRES THE SHOP'S PIN. Anyone could otherwise claim a shop they
-- have never seen and appear in the book of business as its manager. Knowing
-- the PIN means they set it up or the owner handed it over, which is exactly
-- the relationship being recorded. The attempt goes through pin_gate() like
-- every other PIN check on the estate.
--
-- Idempotent. Requires hq/loyalty.sql (reward_settings, reward_members).
-- ============================================================================

create table if not exists public.loop_resellers(
  code        text primary key,               -- short, theirs, appears on reward_settings.ref
  name        text not null,
  agency      text,
  email       text not null,
  pin         text not null,                  -- 4 digits, throttled
  default_price numeric,                      -- what they normally charge a shop
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists loop_resellers_email_idx on public.loop_resellers(lower(btrim(email)));
alter table public.loop_resellers enable row level security;
revoke all on public.loop_resellers from anon;

create table if not exists public.loop_reseller_shops(
  code       text not null references public.loop_resellers(code) on delete cascade,
  client     text not null,                   -- reward_settings.client (the shop slug)
  price      numeric,                         -- what THIS shop pays THEM, monthly
  note       text,
  claimed_at timestamptz not null default now(),
  primary key (code, client)
);
create index if not exists loop_reseller_shops_client_idx on public.loop_reseller_shops(client);
alter table public.loop_reseller_shops enable row level security;
revoke all on public.loop_reseller_shops from anon;

do $$ begin
  execute 'drop policy if exists "admin reads resellers" on public.loop_resellers';
  execute 'create policy "admin reads resellers" on public.loop_resellers for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
  execute 'drop policy if exists "admin reads reseller shops" on public.loop_reseller_shops';
  execute 'create policy "admin reads reseller shops" on public.loop_reseller_shops for all to authenticated
             using ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')
             with check ((auth.jwt()->>''email'')=''nikbyrd28@gmail.com'')';
end $$;

create or replace function public.loop_reseller_gate(p_code text, p_pin text, p_real text)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if to_regprocedure('public.pin_gate(text,text,text)') is not null then
    execute 'select public.pin_gate($1,$2,$3)' using 'rsl:'||lower(btrim(coalesce(p_code,''))), p_pin, p_real;
  end if;
end $$;

create or replace function public.loop_reseller_auth(p_code text, p_pin text)
returns public.loop_resellers language plpgsql security definer set search_path='public','pg_temp' as $$
declare r public.loop_resellers;
begin
  select * into r from public.loop_resellers where upper(btrim(code)) = upper(btrim(coalesce(p_code,''))) limit 1;
  if not found then
    perform public.loop_reseller_gate(p_code, p_pin, '-');
    return null;
  end if;
  perform public.loop_reseller_gate(p_code, p_pin, r.pin);
  if r.pin is distinct from btrim(coalesce(p_pin,'')) then return null; end if;
  update public.loop_resellers set last_seen_at = now() where code = r.code;
  return r;
end $$;

-- Self-serve. A student who has just watched the Loop lesson should be able to
-- become a reseller in the same sitting — a signup that waits on somebody
-- approving it is a signup that goes cold.
create or replace function public.loop_reseller_signup(
  p_name text, p_email text, p_pin text, p_agency text default null, p_price numeric default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_code text; v_base text; v_try int := 0; r public.loop_resellers;
begin
  if length(btrim(coalesce(p_name,''))) < 2 then
    return json_build_object('ok',false,'error','Please enter your name.'); end if;
  if lower(btrim(coalesce(p_email,''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('ok',false,'error','That email does not look right.'); end if;
  if btrim(coalesce(p_pin,'')) !~ '^\d{4}$' then
    return json_build_object('ok',false,'error','Choose a 4-digit PIN.'); end if;

  select * into r from public.loop_resellers where lower(btrim(email)) = lower(btrim(p_email));
  if found then
    return json_build_object('ok',false,'error','That email already has a reseller code — sign in with it.');
  end if;

  v_base := upper(regexp_replace(coalesce(nullif(btrim(coalesce(p_agency,'')),''), btrim(p_name)), '[^A-Za-z0-9]', '', 'g'));
  v_base := left(coalesce(nullif(v_base,''),'AGENCY'), 8);
  loop
    v_try := v_try + 1;
    v_code := v_base || lpad((floor(random()*900)+100)::int::text, 3, '0');
    exit when not exists (select 1 from public.loop_resellers where upper(code) = upper(v_code));
    if v_try >= 15 then v_code := 'RSL' || lpad((floor(random()*900000)+100000)::int::text, 6, '0'); exit; end if;
  end loop;

  insert into public.loop_resellers(code, name, agency, email, pin, default_price)
    values (v_code, btrim(p_name), nullif(btrim(coalesce(p_agency,'')),''), btrim(p_email), btrim(p_pin),
            case when p_price is null or p_price <= 0 then null else round(p_price,2) end)
    returning * into r;

  return json_build_object('ok',true,'code',r.code,'name',r.name,'agency',r.agency);
end $$;

-- Claim a shop you set up. The shop's own PIN is the proof.
create or replace function public.loop_reseller_claim(
  p_code text, p_pin text, p_client text, p_shop_pin text, p_price numeric default null, p_note text default null)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare r public.loop_resellers; v_client text; v_shop_pin text; v_biz text;
begin
  r := public.loop_reseller_auth(p_code, p_pin);
  if r.code is null then return json_build_object('ok',false,'error','Wrong code or PIN.'); end if;

  v_client := lower(btrim(coalesce(p_client,'')));
  v_client := regexp_replace(v_client, '[^a-z0-9]', '', 'g');
  if v_client = '' then return json_build_object('ok',false,'error','Which shop?'); end if;

  select pin, coalesce(biz_name, client) into v_shop_pin, v_biz from public.reward_settings where client = v_client;
  if v_shop_pin is null then return json_build_object('ok',false,'error','No Loop shop with that name. Check the slug.'); end if;

  perform public.loop_reseller_gate('shop:'||v_client, p_shop_pin, v_shop_pin);
  if v_shop_pin is distinct from btrim(coalesce(p_shop_pin,'')) then
    return json_build_object('ok',false,'error','That is not the shop''s PIN.'); end if;

  -- A shop belongs to one reseller. Re-claiming your own updates the price;
  -- claiming somebody else's is refused rather than silently reassigned.
  if exists (select 1 from public.loop_reseller_shops where client = v_client and upper(code) <> upper(r.code)) then
    return json_build_object('ok',false,'error','Another reseller already manages that shop.'); end if;

  insert into public.loop_reseller_shops(code, client, price, note)
    values (r.code, v_client,
            case when p_price is null or p_price <= 0 then r.default_price else round(p_price,2) end,
            nullif(btrim(coalesce(p_note,'')),''))
    on conflict (code, client) do update
      set price = case when excluded.price is null then public.loop_reseller_shops.price else excluded.price end,
          note  = coalesce(excluded.note, public.loop_reseller_shops.note);

  update public.reward_settings set ref = r.code where client = v_client and coalesce(ref,'') = '';

  return json_build_object('ok',true,'client',v_client,'business',v_biz);
end $$;

-- The book of business. Numbers a reseller can read in five seconds and say
-- out loud on a call: how many shops, how many members those shops hold, how
-- many visits happened this month, and what they are billing.
create or replace function public.loop_reseller_book(p_code text, p_pin text)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare r public.loop_resellers; v json; v_total numeric; v_members int; v_shops int;
begin
  r := public.loop_reseller_auth(p_code, p_pin);
  if r.code is null then return json_build_object('ok',false,'error','Wrong code or PIN.'); end if;

  select coalesce(json_agg(x order by x.members desc), '[]'::json) into v from (
    select s.client,
           coalesce(rs.biz_name, s.client) as business,
           s.price,
           s.claimed_at,
           (select count(*) from public.reward_members m where m.client = s.client) as members,
           (select count(*) from public.reward_members m
             where m.client = s.client and m.last_visit_at > now() - interval '30 days') as active_30d,
           (select max(m.last_visit_at) from public.reward_members m where m.client = s.client) as last_visit
      from public.loop_reseller_shops s
      left join public.reward_settings rs on rs.client = s.client
     where upper(s.code) = upper(r.code)) x;

  select count(*), coalesce(sum(price),0) into v_shops, v_total
    from public.loop_reseller_shops where upper(code) = upper(r.code);
  select count(*) into v_members from public.reward_members m
   where m.client in (select client from public.loop_reseller_shops where upper(code) = upper(r.code));

  return json_build_object('ok',true,
    'reseller', json_build_object('code',r.code,'name',r.name,'agency',r.agency,'default_price',r.default_price),
    'shops', v, 'shop_count', v_shops, 'members', v_members, 'monthly', v_total);
end $$;

create or replace function public.loop_reseller_price(p_code text, p_pin text, p_client text, p_price numeric)
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare r public.loop_resellers;
begin
  r := public.loop_reseller_auth(p_code, p_pin);
  if r.code is null then return json_build_object('ok',false,'error','Wrong code or PIN.'); end if;
  update public.loop_reseller_shops
     set price = case when p_price is null or p_price <= 0 then null else round(p_price,2) end
   where upper(code) = upper(r.code) and client = regexp_replace(lower(btrim(coalesce(p_client,''))),'[^a-z0-9]','','g');
  if not found then return json_build_object('ok',false,'error','That shop is not in your book.'); end if;
  return json_build_object('ok',true);
end $$;

create or replace function public.loop_resellers_admin()
returns json language plpgsql security definer set search_path='public','pg_temp' as $$
declare v json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','Not allowed.'); end if;
  select coalesce(json_agg(x order by x.shops desc), '[]'::json) into v from (
    select r.code, r.name, r.agency, r.email, r.created_at, r.last_seen_at,
           (select count(*) from public.loop_reseller_shops s where upper(s.code) = upper(r.code)) as shops,
           (select coalesce(sum(s.price),0) from public.loop_reseller_shops s where upper(s.code) = upper(r.code)) as monthly
      from public.loop_resellers r) x;
  return json_build_object('ok',true,'resellers',v);
end $$;

revoke execute on function public.loop_reseller_auth(text,text)  from public, anon, authenticated;
revoke execute on function public.loop_reseller_gate(text,text,text) from public, anon, authenticated;
revoke execute on function public.loop_resellers_admin()         from public, anon;
grant  execute on function public.loop_reseller_signup(text,text,text,text,numeric)        to anon, authenticated;
grant  execute on function public.loop_reseller_claim(text,text,text,text,numeric,text)    to anon, authenticated;
grant  execute on function public.loop_reseller_book(text,text)                            to anon, authenticated;
grant  execute on function public.loop_reseller_price(text,text,text,numeric)              to anon, authenticated;
grant  execute on function public.loop_resellers_admin()                                   to authenticated;

-- ============================================================================
-- Ambassadors — productized referral / brand-ambassador program
-- ----------------------------------------------------------------------------
-- Free / lead-capture model (no Stripe). A business runs a program; its happy
-- customers become "ambassadors" with a personal code + share link. Friends who
-- use the link become leads in client_leads (client = program slug, ref = code),
-- so referrals attribute automatically. When the owner marks a referred lead
-- Booked/Won, the ambassador's dashboard credits it.
--
-- Programs are keyed by the SAME slug used in /capture/?c=<slug> — the capture
-- page already persists ?ref= into client_leads.ref, so no capture change is
-- needed. Run this whole file in Supabase → SQL Editor (idempotent).
-- ============================================================================

create table if not exists ambassador_programs(
  slug text primary key,            -- matches /capture/?c=<slug>
  business text not null,           -- display name
  reward_text text default 'a reward',
  per_referrals int default 3,      -- referrals needed to earn a reward
  reward_value numeric default 0,   -- optional $ value, for display
  headline text,
  owner_email text,                 -- set to the owner's login; admin overrides
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table ambassador_programs enable row level security;
drop policy if exists "admin or owner manages amb programs" on ambassador_programs;
create policy "admin or owner manages amb programs" on ambassador_programs for all to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or owner_email=(auth.jwt()->>'email'))
  with check ((auth.jwt()->>'email')='nikbyrd28@gmail.com' or owner_email=(auth.jwt()->>'email'));

create table if not exists ambassador_reps(
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references ambassador_programs(slug) on delete cascade,
  name text not null,
  email text,
  phone text,
  code text unique not null,        -- the ?ref= value
  created_at timestamptz default now()
);
alter table ambassador_reps enable row level security;
drop policy if exists "admin or owner reads amb reps" on ambassador_reps;
create policy "admin or owner reads amb reps" on ambassador_reps for select to authenticated
  using ((auth.jwt()->>'email')='nikbyrd28@gmail.com'
         or program_slug in (select slug from ambassador_programs where owner_email=(auth.jwt()->>'email')));
create index if not exists ambassador_reps_prog_idx on ambassador_reps(program_slug);

-- ---- Public read: program info for the join page ---------------------------
create or replace function amb_program(p_slug text)
returns json language plpgsql security definer set search_path=public as $$
declare v ambassador_programs%rowtype;
begin
  select * into v from ambassador_programs where slug=btrim(p_slug) and active;
  if not found then return json_build_object('ok',false,'error','Program not found'); end if;
  return json_build_object('ok',true,'slug',v.slug,'business',v.business,'reward_text',v.reward_text,
    'per',coalesce(v.per_referrals,3),'reward_value',coalesce(v.reward_value,0),'headline',v.headline);
end $$;

-- ---- Join: customer -> ambassador with a unique code (idempotent by email) --
create or replace function amb_join(p_slug text, p_name text, p_email text, p_phone text default null)
returns json language plpgsql security definer set search_path=public as $$
declare v_prog ambassador_programs%rowtype; v_rep ambassador_reps%rowtype; v_code text; v_try int:=0; v_base text;
begin
  if p_slug is null or btrim(p_slug)='' then return json_build_object('ok',false,'error','Missing program'); end if;
  select * into v_prog from ambassador_programs where slug=btrim(p_slug) and active;
  if not found then return json_build_object('ok',false,'error','This program is not available.'); end if;
  if p_name is null or length(btrim(p_name))<2 then return json_build_object('ok',false,'error','Please enter your name.'); end if;
  if p_email is not null and btrim(p_email)<>'' then
    select * into v_rep from ambassador_reps where program_slug=v_prog.slug and lower(email)=lower(btrim(p_email)) limit 1;
    if found then return json_build_object('ok',true,'code',v_rep.code,'name',v_rep.name,'existing',true); end if;
  end if;
  v_base := upper(regexp_replace(split_part(btrim(p_name),' ',1),'[^A-Za-z0-9]','','g'));
  v_base := left(coalesce(nullif(v_base,''),'FAN'),8);
  loop
    v_try := v_try+1;
    v_code := v_base || lpad((floor(random()*900)+100)::int::text,3,'0');
    exit when not exists(select 1 from ambassador_reps where upper(code)=upper(v_code));
    if v_try>=15 then v_code := 'FAN'||lpad((floor(random()*900000)+100000)::int::text,6,'0'); exit; end if;
  end loop;
  insert into ambassador_reps(program_slug,name,email,phone,code)
    values(v_prog.slug, btrim(p_name), nullif(btrim(coalesce(p_email,'')),''), nullif(btrim(coalesce(p_phone,'')),''), v_code);
  return json_build_object('ok',true,'code',v_code,'name',btrim(p_name),'existing',false);
end $$;

-- ---- Dashboard: an ambassador's real stats from client_leads ---------------
create or replace function amb_dashboard(p_slug text, p_code text)
returns json language plpgsql security definer set search_path=public as $$
declare v_prog ambassador_programs%rowtype; v_rep ambassador_reps%rowtype; v_total int; v_booked int; v_recent json;
begin
  select * into v_prog from ambassador_programs where slug=btrim(p_slug);
  if not found then return json_build_object('ok',false,'error','Program not found'); end if;
  select * into v_rep from ambassador_reps where program_slug=v_prog.slug and upper(code)=upper(btrim(p_code)) limit 1;
  if not found then return json_build_object('ok',false,'error','Code not found. Check it and try again.'); end if;
  select count(*) into v_total from client_leads
    where client=v_prog.slug and ref is not null and upper(ref)=upper(v_rep.code);
  select count(*) into v_booked from client_leads
    where client=v_prog.slug and ref is not null and upper(ref)=upper(v_rep.code)
      and status in ('Booked','Won','Converted','Client','Closed','Complete');
  select coalesce(json_agg(json_build_object(
      'who', case when name is null or btrim(name)='' then 'A friend'
        else initcap(split_part(btrim(name),' ',1)) ||
             case when nullif(split_part(btrim(name),' ',2),'') is not null
                  then ' '||left(split_part(btrim(name),' ',2),1)||'.' else '' end end,
      'status', coalesce(status,'New'),
      'at', created_at) order by created_at desc), '[]'::json)
    into v_recent from (
      select name,status,created_at from client_leads
      where client=v_prog.slug and ref is not null and upper(ref)=upper(v_rep.code)
      order by created_at desc limit 10) t;
  return json_build_object('ok',true,'name',v_rep.name,'code',v_rep.code,'business',v_prog.business,
    'total',v_total,'booked',v_booked,'reward_text',v_prog.reward_text,'per',coalesce(v_prog.per_referrals,3),
    'reward_value',coalesce(v_prog.reward_value,0),'recent',v_recent);
end $$;

-- ---- Leaderboard: top ambassadors for a program (masked names) -------------
create or replace function amb_leaderboard(p_slug text)
returns json language plpgsql security definer set search_path=public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object(
     'name', initcap(split_part(btrim(name),' ',1)) ||
             case when nullif(split_part(btrim(name),' ',2),'') is not null then ' '||left(split_part(btrim(name),' ',2),1)||'.' else '' end,
     'code', code, 'total', total, 'booked', booked, 'pts', total*10 + booked*25
   ) order by (total*10 + booked*25) desc, total desc), '[]'::json) into v
  from (
    select r.name, r.code,
      (select count(*) from client_leads l where l.client=p_slug and l.ref is not null and upper(l.ref)=upper(r.code))::int as total,
      (select count(*) from client_leads l where l.client=p_slug and l.ref is not null and upper(l.ref)=upper(r.code)
         and l.status in ('Booked','Won','Converted','Client','Closed','Complete'))::int as booked
    from ambassador_reps r where r.program_slug=p_slug
  ) t;
  return json_build_object('ok',true,'rows',v);
end $$;

-- ---- Owner: create / update a program (authenticated only) -----------------
create or replace function amb_program_upsert(p_slug text, p_business text, p_reward_text text, p_per int, p_reward_value numeric, p_headline text)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text; v_existing ambassador_programs%rowtype;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then return json_build_object('ok',false,'error','Sign in required'); end if;
  if p_slug is null or btrim(p_slug)='' or p_business is null or btrim(p_business)='' then
    return json_build_object('ok',false,'error','Slug and business are required'); end if;
  select * into v_existing from ambassador_programs where slug=btrim(p_slug);
  if found and v_existing.owner_email is not null and v_existing.owner_email<>v_email and v_email<>'nikbyrd28@gmail.com' then
    return json_build_object('ok',false,'error','This program belongs to another account.'); end if;
  insert into ambassador_programs(slug,business,reward_text,per_referrals,reward_value,headline,owner_email,active,updated_at)
    values(btrim(p_slug),btrim(p_business),coalesce(nullif(btrim(coalesce(p_reward_text,'')),''),'a reward'),
           coalesce(p_per,3),coalesce(p_reward_value,0),nullif(btrim(coalesce(p_headline,'')),''),v_email,true,now())
  on conflict (slug) do update set business=excluded.business, reward_text=excluded.reward_text,
    per_referrals=excluded.per_referrals, reward_value=excluded.reward_value, headline=excluded.headline, updated_at=now();
  return json_build_object('ok',true,'slug',btrim(p_slug));
end $$;

-- Grants: anon can read/join; only authenticated can create/edit a program.
grant execute on function amb_program(text)               to anon, authenticated;
grant execute on function amb_join(text,text,text,text)    to anon, authenticated;
grant execute on function amb_dashboard(text,text)         to anon, authenticated;
grant execute on function amb_leaderboard(text)            to anon, authenticated;
grant execute on function amb_program_upsert(text,text,text,int,numeric,text) to authenticated;
-- Postgres grants EXECUTE to PUBLIC by default; lock the owner RPC down.
revoke execute on function public.amb_program_upsert(text,text,text,int,numeric,text) from public, anon;

-- ---- Demo seed (safe to re-run) --------------------------------------------
insert into ambassador_programs(slug,business,reward_text,per_referrals,reward_value,headline,owner_email,active)
values('demo-barbers','Demo Barbershop','a free haircut',3,35,'Refer friends, earn free cuts','nikbyrd28@gmail.com',true)
on conflict (slug) do nothing;
insert into ambassador_reps(program_slug,name,email,code)
values('demo-barbers','Alex Rivera','alex@example.com','ALEX10')
on conflict (code) do nothing;

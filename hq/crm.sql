-- ============================================================================
-- LOOP CRM — the shops Nick is selling to, and what actually happened.
--
-- ── WHY NOT ONE OF THE FOUR CRMs THAT ALREADY EXIST ─────────────────────────
-- There are already: public.prospects and public.leads (the TB Solutions
-- agency era — email, name, status, and nothing else), public.client_leads
-- (leads that hit a CLIENT's own capture page — Voom Lux ride requests), and
-- /center/ crm_members (a barber's view of HIS customers). None of them is
-- the thing being asked for here, and prospects/leads in particular can't be
-- stretched into it: they have no phone, no address, no Instagram. You cannot
-- work a barbershop from an email address. You walk in, or you ring the shop.
--
-- ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
-- /kit/targets/ — 45 researched Chester County shops with phone, IG, address
-- and an angle for each. Good list. But its status lives in localStorage, so:
-- it is one device, it dies when the browser is cleared, it holds a single
-- word per shop and no notes, and it has no idea when he last spoke to anyone.
-- That page stays as it is — reps use it offline, it needs no key. This is the
-- same 45 shops with a spine.
--
-- ── THE RULE THAT MAKES THIS WORTH BUILDING: STATUS IS NOT TYPED ────────────
-- A hand-typed "Signed" is a lie within a fortnight. Every row here is joined
-- live to reward_settings — so the CRM knows on its own whether a shop has a
-- Loop account, how many members it has, and whether a single customer has
-- ever actually punched a card. "Signed, 0 members, 0 visits" is the most
-- important row on the screen and no amount of typing would ever produce it.
-- Nick types intent (who to chase, what was said). The platform supplies fact.
--
-- ── MATCHING A CRM ROW TO A REAL SHOP ───────────────────────────────────────
-- Auto-linked on an exact match of the squashed name: "Chester County Hair
-- Company" -> chestercountyhaircompany, against reward_settings.biz_name
-- squashed the same way. Phone would have been the better key and is not
-- available — reward_settings stores no phone number for a shop, only
-- owner_email — so the name is all there is. Anything fuzzier than exact
-- guesses, and a wrong link shows one shop's customer numbers under another
-- shop's name; everything else is offered as a suggestion Nick taps to
-- confirm, never applied on its own.
-- ============================================================================

create table if not exists public.loop_crm (
  id          bigint generated always as identity primary key,
  slug        text not null unique,          -- stable id from the name; survives a rename
  name        text not null,
  town        text,
  address     text,
  phone       text,
  instagram   text,
  angle       text,                          -- the one line of why-them from the research
  owner_name  text,
  email       text,
  status      text not null default 'lead',  -- lead | pitched | warm | signed | no
  client      text,                          -- reward_settings.client, once linked
  note        text,
  next_at     date,                          -- when to chase. the whole point of a CRM.
  rank        int  default 0,                -- top-10 priority from the research, 0 = not ranked
  source      text default 'walklist',       -- walklist | added
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists loop_crm_status on public.loop_crm(status, next_at);
-- one Loop shop belongs to exactly one CRM row. Without this a bug anywhere in
-- the linking logic shows the same shop's members under two different names.
create unique index if not exists loop_crm_client_uniq
  on public.loop_crm(client) where client is not null;
create index if not exists loop_crm_phone10 on public.loop_crm
  (right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10));

-- Every touch, kept forever. "I pitched Champions three weeks ago and never
-- rang back" is a thing you can only see if the touches are dated rows rather
-- than a note field he overwrites.
create table if not exists public.loop_crm_touch (
  id      bigint generated always as identity primary key,
  crm_id  bigint not null references public.loop_crm(id) on delete cascade,
  kind    text not null default 'note',      -- call | walk | dm | text | email | note
  body    text,
  at      timestamptz not null default now()
);
create index if not exists loop_crm_touch_row on public.loop_crm_touch(crm_id, at desc);

alter table public.loop_crm       enable row level security;
alter table public.loop_crm_touch enable row level security;
-- No policies on purpose. Every read and write below is SECURITY DEFINER behind
-- the admin key; nothing reaches these tables with the anon key directly.

-- squash a business name to letters and digits so "Chester County Hair Company"
-- and "chester county hair company " are the same string
create or replace function public.crm_squash(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(t,'')), '[^a-z0-9]', '', 'g')
$$;

create or replace function public.crm_gate(p_key text)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.admin_config where k = p_key)
$$;

-- ----------------------------------------------------------------------------
-- crm_list — the whole board, with the platform's own numbers attached.
--
-- It also self-heals on every read: any row not yet tied to a Loop shop is
-- linked if exactly ONE unlinked Loop shop matches it on squashed name.
-- "Exactly one" is doing real work there — two shops called "Sal's Barbershop"
-- exist in this list, and guessing between them would file Phoenixville's
-- customers under Chester Springs. Ambiguous matches are returned as a
-- suggestion instead and wait for a tap.
-- ----------------------------------------------------------------------------
create or replace function public.crm_list(p_key text, p_view text default 'all')
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_rows jsonb; v_view text := lower(coalesce(p_view,'all'));
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;

  -- self-heal: link only where the match is one-to-one in BOTH directions.
  -- One CRM row matching two shops is ambiguous, and so is one shop matching
  -- two CRM rows — the second case is the one that bites, because both rows
  -- would claim the same shop and the same customers would be counted twice.
  with pairs as (
    select c.id as crm_id, s.client
      from public.loop_crm c
      join public.reward_settings s
        on public.crm_squash(s.biz_name) = public.crm_squash(c.name)
     where c.client is null
       and public.crm_squash(c.name) <> ''
       and not exists (select 1 from public.loop_crm x where x.client = s.client)
  )
  update public.loop_crm c
     set client = u.client, updated_at = now(),
         status = case when c.status in ('lead','pitched','warm') then 'signed' else c.status end
    from (select crm_id, client from pairs
           where crm_id in (select crm_id from pairs group by crm_id having count(*) = 1)
             and client in (select client from pairs group by client having count(*) = 1)) u
   where c.id = u.crm_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_key, r.rank_key, r.name), '[]'::jsonb)
    into v_rows
    from (
      select c.id, c.slug, c.name, c.town, c.address, c.phone, c.instagram, c.angle,
             c.owner_name, c.email, c.status, c.client, c.note, c.next_at, c.rank, c.source,
             s.biz_name,
             coalesce(s.is_active, true) as active,
             (s.client is not null) as on_loop,
             coalesce((select count(*) from public.reward_members m where m.client = s.client), 0) as members,
             coalesce((select count(*) from public.reward_points_ledger g
                        where g.client = s.client and g.kind = 'BASE_VISIT'), 0) as visits,
             s.created_at::date as joined_on,
             (select t.at from public.loop_crm_touch t where t.crm_id = c.id order by t.at desc limit 1) as last_touch,
             (select t.kind from public.loop_crm_touch t where t.crm_id = c.id order by t.at desc limit 1) as last_kind,
             (select t.body from public.loop_crm_touch t where t.crm_id = c.id order by t.at desc limit 1) as last_body,
             (select count(*) from public.loop_crm_touch t where t.crm_id = c.id) as touches,
             -- a shop that could be this one but wasn't safe to link on its own
             (select jsonb_agg(jsonb_build_object('client', s2.client, 'biz_name', s2.biz_name))
                from public.reward_settings s2
               where c.client is null
                 and public.crm_squash(s2.biz_name) = public.crm_squash(c.name)
                 and not exists (select 1 from public.loop_crm x where x.client = s2.client)) as maybe,
             case c.status when 'signed' then 0 when 'warm' then 1 when 'pitched' then 2
                           when 'lead' then 3 else 4 end as sort_key,
             case when c.rank > 0 then c.rank else 99 end as rank_key
        from public.loop_crm c
        left join public.reward_settings s on s.client = c.client
       where case v_view
               when 'due'    then c.next_at is not null and c.next_at <= current_date
               when 'signed' then c.client is not null
               when 'open'   then c.status in ('lead','pitched','warm')
               when 'top'    then c.rank > 0
               else true end
    ) r;

  return jsonb_build_object('ok', true, 'rows', v_rows,
    'counts', (select jsonb_build_object(
        'all',    count(*),
        'signed', count(*) filter (where client is not null),
        'open',   count(*) filter (where status in ('lead','pitched','warm')),
        'due',    count(*) filter (where next_at is not null and next_at <= current_date),
        'no',     count(*) filter (where status = 'no'))
      from public.loop_crm));
end $$;

-- ----------------------------------------------------------------------------
-- crm_save — one field at a time, because this is used one-handed on a phone.
-- Only the listed keys are writable; `client` is deliberately NOT among them,
-- so a typo in a note can never silently repoint a row at another shop's data.
-- ----------------------------------------------------------------------------
create or replace function public.crm_save(p_key text, p_id bigint, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_st text;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_st := nullif(btrim(coalesce(p_patch->>'status','')), '');
  if v_st is not null and v_st not in ('lead','pitched','warm','signed','no') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;

  update public.loop_crm set
    status     = coalesce(v_st, status),
    note       = case when p_patch ? 'note'       then left(nullif(btrim(p_patch->>'note'),''), 2000) else note end,
    next_at    = case when p_patch ? 'next_at'    then nullif(p_patch->>'next_at','')::date            else next_at end,
    phone      = case when p_patch ? 'phone'      then left(nullif(btrim(p_patch->>'phone'),''), 30)   else phone end,
    email      = case when p_patch ? 'email'      then lower(left(nullif(btrim(p_patch->>'email'),''), 120)) else email end,
    owner_name = case when p_patch ? 'owner_name' then left(nullif(btrim(p_patch->>'owner_name'),''), 80) else owner_name end,
    instagram  = case when p_patch ? 'instagram'  then left(nullif(btrim(regexp_replace(coalesce(p_patch->>'instagram',''),'^@','')),''), 60) else instagram end,
    updated_at = now()
   where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ----------------------------------------------------------------------------
-- crm_touch — log what happened, and set the next chase in the same tap.
-- The status nudge is the point: a barber you just rang is 'pitched' whether or
-- not you remember to change a dropdown afterwards. It only ever moves a row
-- FORWARD out of 'lead' — it will not drag a signed shop back.
-- ----------------------------------------------------------------------------
create or replace function public.crm_touch(
  p_key text, p_id bigint, p_kind text, p_body text default null,
  p_next_at text default null, p_status text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_kind text; v_st text; v_next date;
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

  begin v_next := nullif(btrim(coalesce(p_next_at,'')),'')::date;
  exception when others then v_next := null; end;

  insert into public.loop_crm_touch (crm_id, kind, body)
  values (p_id, v_kind, left(nullif(btrim(coalesce(p_body,'')),''), 2000));

  update public.loop_crm set
    status  = coalesce(v_st,
                case when status = 'lead' and v_kind in ('call','walk','dm','text','email')
                     then 'pitched' else status end),
    next_at = case when v_next is not null then v_next
                   when p_next_at = '' then null else next_at end,
    updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.crm_history(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  return jsonb_build_object('ok', true, 'touches', coalesce((
    select jsonb_agg(to_jsonb(t) order by t.at desc)
      from (select id, kind, body, at from public.loop_crm_touch
             where crm_id = p_id order by at desc limit 60) t), '[]'::jsonb));
end $$;

-- ----------------------------------------------------------------------------
-- crm_add — a shop spotted on the walk that the research missed. Name only is
-- enough; everything else can be filled in later from the doorway.
-- ----------------------------------------------------------------------------
create or replace function public.crm_add(
  p_key text, p_name text, p_town text default null, p_phone text default null,
  p_address text default null, p_instagram text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_slug text; v_name text; v_id bigint; v_n int := 1;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_name := left(btrim(coalesce(p_name,'')), 90);
  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'Needs a name.'); end if;
  v_slug := nullif(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '');
  v_slug := btrim(coalesce(v_slug,'shop'), '-');
  while exists (select 1 from public.loop_crm where slug = v_slug) loop
    v_n := v_n + 1; v_slug := btrim(regexp_replace(lower(v_name),'[^a-z0-9]+','-','g'),'-') || '-' || v_n;
  end loop;

  insert into public.loop_crm (slug, name, town, phone, address, instagram, source)
  values (v_slug, v_name, nullif(btrim(coalesce(p_town,'')),''),
          left(nullif(btrim(coalesce(p_phone,'')),''),30),
          left(nullif(btrim(coalesce(p_address,'')),''),160),
          left(nullif(btrim(regexp_replace(coalesce(p_instagram,''),'^@','')),''),60),
          'added')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end $$;

-- ----------------------------------------------------------------------------
-- crm_link / crm_unlink — confirm or undo the tie to a real Loop shop. This is
-- the only path that writes loop_crm.client, and it refuses a shop that is
-- already spoken for rather than quietly moving it.
-- ----------------------------------------------------------------------------
create or replace function public.crm_link(p_key text, p_id bigint, p_client text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_c text;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_c := lower(btrim(coalesce(p_client,'')));
  if v_c = '' then
    update public.loop_crm set client = null, updated_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'client', null);
  end if;
  if not exists (select 1 from public.reward_settings where client = v_c) then
    return jsonb_build_object('ok', false, 'error', 'No Loop shop with that code.');
  end if;
  if exists (select 1 from public.loop_crm where client = v_c and id <> p_id) then
    return jsonb_build_object('ok', false, 'error', 'That shop is already on another row.');
  end if;
  update public.loop_crm
     set client = v_c,
         status = case when status in ('lead','pitched','warm') then 'signed' else status end,
         updated_at = now()
   where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'No such shop.'); end if;
  return jsonb_build_object('ok', true, 'client', v_c);
end $$;

-- ----------------------------------------------------------------------------
-- crm_unclaimed — Loop shops with nobody's name against them. A barber who
-- signs up off a poster or a share link never went through the walk list, and
-- without this he is invisible to the pipeline.
-- ----------------------------------------------------------------------------
-- Shops that are on Loop but will never be leads: Nick's own test shops, and
-- the client sites that are not barbershops. Without a dismissal the panel is
-- eleven rows of junk and one real signup, so the real signup gets scrolled
-- past — which defeats the only reason the panel exists.
create table if not exists public.loop_crm_ignore (
  client text primary key,
  at     timestamptz not null default now()
);
alter table public.loop_crm_ignore enable row level security;

create or replace function public.crm_ignore(p_key text, p_client text, p_undo boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_c text;
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  v_c := lower(btrim(coalesce(p_client,'')));
  if v_c = '' then return jsonb_build_object('ok', false, 'error', 'Which shop?'); end if;
  if coalesce(p_undo,false) then
    delete from public.loop_crm_ignore where client = v_c;
  else
    insert into public.loop_crm_ignore(client) values (v_c) on conflict (client) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.crm_unclaimed(p_key text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.crm_gate(p_key) then
    return jsonb_build_object('ok', false, 'error', 'Wrong admin key.');
  end if;
  return jsonb_build_object('ok', true,
    'hidden', (select count(*) from public.loop_crm_ignore),
    'shops', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.created_at desc)
      from (select r.client, r.biz_name, r.owner_email, r.created_at::date as created_at,
                   (select count(*) from public.reward_members m where m.client = r.client) as members
              from public.reward_settings r
             where not exists (select 1 from public.loop_crm x where x.client = r.client)
               and not exists (select 1 from public.loop_crm_ignore i where i.client = r.client)
             order by r.created_at desc limit 60) s), '[]'::jsonb));
end $$;

revoke execute on function public.crm_gate(text)                       from public, anon, authenticated;
revoke execute on function public.crm_list(text,text)                  from public, anon, authenticated;
revoke execute on function public.crm_save(text,bigint,jsonb)          from public, anon, authenticated;
revoke execute on function public.crm_touch(text,bigint,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.crm_history(text,bigint)             from public, anon, authenticated;
revoke execute on function public.crm_add(text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.crm_link(text,bigint,text)           from public, anon, authenticated;
revoke execute on function public.crm_unclaimed(text)                  from public, anon, authenticated;
revoke execute on function public.crm_ignore(text,text,boolean)        from public, anon, authenticated;

grant execute on function public.crm_list(text,text)                  to anon, authenticated;
grant execute on function public.crm_save(text,bigint,jsonb)          to anon, authenticated;
grant execute on function public.crm_touch(text,bigint,text,text,text,text) to anon, authenticated;
grant execute on function public.crm_history(text,bigint)             to anon, authenticated;
grant execute on function public.crm_add(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.crm_link(text,bigint,text)           to anon, authenticated;
grant execute on function public.crm_unclaimed(text)                  to anon, authenticated;
grant execute on function public.crm_ignore(text,text,boolean)        to anon, authenticated;


-- ----------------------------------------------------------------------------
-- SEED — the 45 shops from the /kit/targets/ research, verbatim. Generated from
-- that page's SHOPS array by tools/gen-crm-seed.cjs rather than retyped, so the
-- two cannot drift apart on a transcription slip. `on conflict do nothing`
-- means re-running this file is safe: it never overwrites a status or a note.
-- ----------------------------------------------------------------------------
insert into public.loop_crm (slug, name, town, address, phone, instagram, angle, rank) values
  ('expensive-styles', 'Expensive Styles', 'Coatesville', '237 MLK Dr, 19320', null, 'expensive.styles', 'Urban-style shop, active IG with tagged barbers. The arcade + free-cuts angle fits its young clientele.', 2),
  ('roots-barbershop', 'Roots Barbershop', 'Coatesville', '9 N 2nd Ave, 19320', null, null, 'Books through Booksy and pays per-booking fees. Pitch Loop as $0-to-start retention that rides on top of Booksy instead of competing with it.', 3),
  ('the-best-kept-secret', 'The Best Kept Secret', 'Coatesville', '725 E Lincoln Hwy, 19320', null, null, 'Walk-in-friendly fade shop with no loyalty program. Loop gives walk-ins a reason to come back to this shop specifically.', 4),
  ('coatesville-cuts-kev-the-barber', 'Coatesville Cuts (Kev the Barber)', 'Coatesville', '7 N 2nd Ave, 19320', '(484) 467-0857', null, 'Owner-operator, 30+ years, active Facebook. The whole business is loyal regulars — that''s the pitch.', 0),
  ('bookman-s-barber-beauty', 'Bookman''s Barber & Beauty', 'Coatesville', '708 E Lincoln Hwy, 19320', null, null, 'Long-standing Black-owned barber + beauty shop. Multi-service upsell.', 0),
  ('peoples-barber-shop', 'Peoples Barber Shop', 'Coatesville', '10 S 3rd Ave, 19320', '(610) 384-3884', null, 'Open 7am–7pm, high-volume walk-ins. The punch mechanic fits.', 0),
  ('life-cutz', 'Life Cutz', 'Coatesville', '567 S 1st Ave, 19320', null, null, 'Independent urban shop, books via Fresha, no visible loyalty program.', 0),
  ('relax-barbershop', 'Relax Barbershop', 'Coatesville', '768 Lincoln Hwy E, 19320', null, 'relax__barbershop', 'On Fresha + IG with a small following — hungry for retention tools.', 0),
  ('chester-county-hair-company', 'Chester County Hair Company', 'Coatesville', 'Coatesville (Booksy listing)', null, null, 'Independent on Booksy. Retention app is an easy add-on pitch.', 0),
  ('givler-s-barber-shop', 'Givler''s Barber Shop', 'Coatesville', 'Coatesville (active FB page)', null, null, 'Old-school independent. Low-tech today means the biggest jump in perceived value.', 0),
  ('champions-premier-barber-shop', 'Champions Premier Barber Shop', 'West Chester', '133 N Church St, 19380 (+ 2nd on N High St)', null, 'champions_premierbarbers', 'Black-owned, two locations, very active IG, community-first branding. Pitch Loop as the digital version of the community loyalty they already live.', 1),
  ('maple-alley-barbershop', 'Maple Alley Barbershop', 'West Chester', '537 Maple Alley, 19380', '(484) 887-8475', 'maplealleybarbershop', 'Waves, fades and shaves, 4.9 on Booksy, active IG. Ideal repeat-cut clientele for free-cut rewards.', 5),
  ('vic-tory-barbershop', 'VIC-TORY Barbershop', 'West Chester', '11 N 5 Points Rd, 19380', '(610) 679-0885', '11n.victorybarbershop', 'Independent fade/lineup specialist with its own site. Turn their strong review flow into repeat visits.', 6),
  ('the-shop-on-market-street', 'The Shop on Market Street', 'West Chester', '134 E Market St, 19382', '(610) 545-3732', 'theshoponmarketstreet', 'Woman-owned ("Girl Barbers Rule"), Reader''s Choice Best Barber Shop, active social.', 0),
  ('charlie-co-barbershop', 'Charlie & Co. Barbershop', 'West Chester', '130 N Church St, 19380', '(484) 266-0781', 'charlieandcobarbershop', '"Modern meets old school," active IG posting client cuts.', 0),
  ('c-mac-s-barbershop', 'C Mac''s Barbershop', 'West Chester', '133 E Market St, 19382', '(610) 696-9336', null, 'Rock-and-roll-themed, woman-owned. Fun brand — the arcade fits.', 0),
  ('cruisin-style-barber-shop', 'Cruisin'' Style Barber Shop', 'West Chester', '135 W Gay St, 19380', null, 'sailorandy_thebarber', 'Garage-deco themed, "voted best in WC." Strong brand, no loyalty app.', 0),
  ('mark-jos-barbers', 'Mark Jos. Barbers', 'West Chester', '133 N Church St Ste 103B, 19380', null, null, 'Independent full-service barber with its own site. Borough foot traffic.', 0),
  ('simply-men-s-barber-shop', 'Simply Men''s Barber Shop', 'West Chester', '105 Westtown Rd Ste C, 19382', '(484) 887-0635', null, 'Traditional businessmen''s shop, steady repeat clientele, no loyalty program.', 0),
  ('rik-s-barbershop', 'Rik''s Barbershop', 'Exton', '63 Marchwood Rd, 19341', null, 'riksbarbershops', '5.0 stars over 227 reviews, mission-driven owner-operator brand. Loop is the retention layer matching his "transformational grooming" positioning.', 7),
  ('the-cut-gallery-barbershop', 'The Cut Gallery Barbershop', 'Exton', '582 Wharton Blvd (Eagleview Town Ctr), 19341', null, 'thecutgallerybarbershop', '"Art meets grooming" concept shop. A branded arcade web app fits their creative identity.', 9),
  ('ficca-s-barber-shop', 'Ficca''s Barber Shop', 'Exton', '140 Eagleview Blvd, 19341', null, null, 'Family independent, active FB, multi-chair, no loyalty program.', 0),
  ('sal-s-barbershop-chester-springs-exton', 'Sal''s Barbershop Chester Springs & Exton', 'Exton / Chester Springs', '491 E Uwchlan Ave, Chester Springs 19425', null, null, 'Award-winning local multi-shop group — one yes is multiple locations.', 0),
  ('catracho-cuts', 'Catracho Cuts', 'Malvern', '446 Lancaster Ave STE 1, 19355', null, 'catracho_cuts', 'Bilingual premium independent on Booksy. The game/rewards app is a differentiator no nearby Main Line shop has.', 8),
  ('gentlemen-s-cut', 'Gentlemen''s Cut', 'Malvern', '12 General Warren Blvd Ste 350, 19355', '(610) 640-9844', null, 'Multi-chair men''s shop, strong reviews, no visible loyalty program.', 0),
  ('maurizio-barber-shop', 'Maurizio Barber Shop', 'Malvern', 'Malvern (directory-verified)', null, null, 'Walk-in-friendly independent. Thin web footprint — verify it''s still operating before driving out.', 0),
  ('the-breakroom-barbershop', 'The Breakroom Barbershop', 'Phoenixville', '166 Bridge St, 19460', '(215) 913-4617', 'breakroombarbershop', 'Brand-new two-founder shop in a renovated historic building. New shops need retention from day one and have zero legacy program.', 10),
  ('blue-label-men-s-grooming', 'Blue Label Men''s Grooming', 'Phoenixville', '321 Bridge St, 19460', '(484) 369-9054', 'bluelabelmen', 'Upscale independent on Bridge St, active IG, premium clientele.', 0),
  ('sal-s-barbershop-phoenixville', 'Sal''s Barbershop Phoenixville', 'Phoenixville', '390 Schuylkill Rd Ste 200, 19460', '(484) 924-9330', null, '5.0 stars over 168 reviews, part of a local 5-shop group — multi-location potential.', 0),
  ('bridge-street-barber', 'Bridge Street Barber', 'Phoenixville', '1098 W Bridge St, 19460', null, null, 'Newly taken over by owner-operator Rick Ferko. New owners buy new tools.', 0),
  ('eddie-the-barber', 'Eddie The Barber', 'Phoenixville', '119 Main St Ste 4, 19460', '(484) 630-7506', null, 'Appointment-only solo barber. Loop keeps his book full between visits.', 0),
  ('blue-52-barber-shop', 'Blue 52 Barber Shop', 'Kennett Square', '331 E State St, 19348', '(610) 612-9361', 'blue52barbershop', 'Family-friendly downtown independent, active IG, books on Vagaro.', 0),
  ('ksq-barber-lounge', 'KSQ Barber Lounge', 'Kennett Square', '106 Sycamore Alley, 19348', null, 'ksqbarberlounge', 'Modern lounge in the heart of KSQ, active IG + Vagaro.', 0),
  ('burton-s-barber-shop', 'Burton''s Barber Shop', 'Kennett Square', '105 W State St, 19348', '(610) 444-9964', null, 'In business since 1892, third-generation owner. Heritage story, zero digital loyalty.', 0),
  ('b-b-barber-lounge', 'B & B Barber Lounge', 'Kennett Square', '116 S Union St, 19348', null, null, 'Independent lounge-style shop, active FB, urban clientele.', 0),
  ('fragale-brothers-barber-shop', 'Fragale Brothers Barber Shop', 'Kennett Square', 'Kennett Square (active FB page)', null, null, 'Small independent with a loyal base. Simple free-cuts pitch.', 0),
  ('dazio-s-barber-shop', 'Dazio''s Barber Shop', 'Downingtown', '135 W Lancaster Ave, 19335', null, null, 'Independent razor-shave traditionalist, no loyalty program visible.', 0),
  ('eddie-s-barber-shop', 'Eddie''s Barber Shop', 'Downingtown', '21 Brandywine Ave, 19335', '(610) 269-4288', null, 'Established walk-in shop in the borough center, regulars-driven.', 0),
  ('jb-s-barber-shop', 'JB''s Barber Shop', 'Downingtown', '3933 Lincoln Hwy (Caln Village Ctr), 19335', '(484) 364-4933', 'jbsbarbershop2020', 'Active IG, "old school feel, modern twist" — open to tech.', 0),
  ('popjoy-s-barber-shop', 'Popjoy''s Barber Shop', 'Downingtown', '886 Horseshoe Pike, 19335', '(484) 459-6369', null, 'Appointment-only owner-operator with its own website. Upsell repeat-visit rewards.', 0),
  ('flip-s-barber-shop', 'Flip''s Barber Shop', 'Oxford', '10 S 3rd St, 19363', '(610) 467-1670', null, '4.6 stars over 95 reviews, Main Street independent, books via Fresha.', 0),
  ('3rd-street-parlor-jesus-garcia', '3rd Street Parlor (Jesus Garcia)', 'Oxford', '3 S 3rd St, 19363', '(484) 756-0891', null, 'Independent, Latino-owned. The bilingual-friendly free-cuts hook lands here.', 0),
  ('charlie-s-barber-shop', 'Charlie''s Barber Shop', 'Paoli', '16 Lancaster Ave, 19301', '(610) 296-8287', null, 'Old-school independent on the main drag, regulars-based.', 0),
  ('gentlemen-s-choice-barber-shop', 'Gentlemen''s Choice Barber Shop', 'Paoli', '11 Paoli Shopping Center, 19301', null, null, 'Shopping-center multi-chair shop with steady commuter clientele.', 0),
  ('jerry-s-barber-shop', 'Jerry''s Barber Shop', 'Paoli', '16 W Lancaster Ave, 19301', null, null, 'Long-standing independent, well reviewed, no digital loyalty presence.', 0)
on conflict (slug) do nothing;

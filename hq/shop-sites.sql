-- ============================================================================
-- Loop — shop websites ("Loop Sites")
-- ----------------------------------------------------------------------------
-- WHAT THIS IS
-- Most barbershops have no website, a dead link in their Instagram bio, and a
-- Google Business Profile with the Website field left empty. This gives every
-- Loop shop a real one-page site at tbsol.net/shop/?c=<slug> that is generated
-- from data the shop ALREADY typed into Loop — biz_name, services, hours,
-- reward_text, google_review_url — plus a small `site` blob for the handful of
-- things Loop never asked for (address, phone, tagline, photos, IG handle).
--
-- DELIBERATELY NOT A WEBSITE BUILDER. One template, four themes. N hand-made
-- templates would be N files drifting out of sync with booking and rewards —
-- the exact "lot of the same pages, slightly different" problem. A `theme` key
-- gives the look of a template pack with one codebase.
--
-- THE RPCs
--   shop_site_payload(p_client)          the page body — NOT granted to anon
--   shop_site(p_client)                  public read  — anon, checks published
--   shop_site_admin(p_client,p_pin)      owner preview — same payload, no gate
--   shop_site_set(p_client,p_pin,p_site) owner write  — PIN-gated
--
-- shop_site and shop_site_admin both return shop_site_payload() rather than
-- each building their own object. The editor previews an UNPUBLISHED site by
-- posting the admin payload into a hidden /shop/ iframe, so a second copy of
-- the builder would mean the owner edits against a preview that lies. A probe
-- asserts the two outputs are byte-identical once published.
--
-- SECURITY: shop_site is called with the anon key by an unauthenticated
-- visitor, so it must never return anything the shop did not choose to
-- publish. It builds its result from an explicit WHITELIST rather than
-- to_jsonb(s) minus a few keys — a blocklist silently starts leaking the day
-- someone adds a column. Specifically NOT returned: pin, owner_email,
-- owner_name, stripe_customer, plan_status, ref, automations, coin_store,
-- lottery, membership, spin_prizes, game settings, and staff (staff entries
-- may carry a phone; only the NAME is exposed, and only when the shop turned
-- the team section on).
--
-- SANITISING ON WRITE: site_sanitize() runs on every write and is a whitelist
-- too. It exists because the values land in a page as href/src attributes —
-- an unsanitised `javascript:` or `data:` URL in `maps` or `hero` would be a
-- stored XSS against the shop's own customers. Anything that is not plainly
-- http(s) is dropped. The page escapes on render as well; both layers stay.
--
-- shop_site returns is_active/on state honestly rather than 404-ing, so the
-- page can say "this site isn't published yet" instead of looking broken.
--
-- ── v2 ──────────────────────────────────────────────────────────────────────
-- Added because a page nobody finishes filling in is worth nothing:
--   · PHOTO UPLOAD. The editor sends straight from the camera roll to the
--     shop-sites bucket below. There is deliberately nowhere in the editor to
--     paste an image URL — that step is where a barber gives up.
--   · REVIEWS. Loop already collects and approves them; the page now shows the
--     star average in the header and the three best quotes. Nothing new is
--     collected, and only the reviewer's FIRST name goes out.
--   · A per-shop accent colour on top of the four themes, plus a logo and up
--     to three self-named buttons — the "make it mine" surface.
--   · A tap-to-text button, because barbers run on SMS.
-- A shop with no photos yet gets line-art tiles drawn client-side in its own
-- accent, so the page reads as designed rather than unfinished. Those are
-- inline SVG in /shop/index.html, not stock photography: nothing to license,
-- and another shop's interior on a barber's own page would be a lie.
-- ============================================================================

alter table public.reward_settings add column if not exists site jsonb;

-- ----------------------------------------------------------------------------
-- Where uploaded logos and photos live.
--
-- A DEDICATED bucket rather than the existing `uploads`: that one is wide open
-- to anon with no size or type limit, and several other pages depend on it, so
-- tightening it in place would break them. This one takes images only and caps
-- a file at 6 MB, which is meaningfully narrower than what already exists.
--
-- Public read comes from the bucket's own `public` flag (Supabase serves
-- /object/public/<bucket>/... without consulting RLS), so no SELECT policy is
-- needed and none is granted.
--
-- Anon may INSERT but NOT update or delete: the editor names every file
-- <client>/<random>, so two shops can never collide, a re-upload never
-- overwrites a photo still on a live page, and nobody can wipe another shop's
-- gallery. Removing a photo in the editor drops it from the shop's list and
-- leaves the object orphaned — cheap, and the safe direction to fail.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-sites','shop-sites', true, 6291456,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop sites: anon upload" on storage.objects;
create policy "shop sites: anon upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'shop-sites');

-- ----------------------------------------------------------------------------
-- Whitelist + coerce the site blob. Pure; no table access.
-- Unknown keys are DROPPED, not kept — this is the only thing standing between
-- the owner editor and arbitrary jsonb reaching a template.
-- ----------------------------------------------------------------------------
create or replace function public.site_sanitize(p jsonb)
returns jsonb language plpgsql immutable as $$
declare
  out_j jsonb := '{}'::jsonb;
  ph    jsonb := '[]'::jsonb;
  bt    jsonb := '[]'::jsonb;
  u     text;
  k     text;
  lbl   text;
  e     jsonb;
  n     int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;

  -- booleans are read as TEXT and matched, never cast: a cast of 'maybe' would
  -- raise and take the owner's entire save with it
  out_j := out_j || jsonb_build_object('on',
    lower(coalesce(p->>'on','')) in ('true','t','1','yes','on'));

  out_j := out_j || jsonb_build_object('theme',
    case lower(coalesce(p->>'theme','')) when 'fade' then 'fade' when 'luxe' then 'luxe'
         when 'bold' then 'bold' else 'classic' end);

  -- an optional accent that overrides the theme's own. Six hex digits or
  -- nothing: anything else would land inside a style attribute.
  u := btrim(coalesce(p->>'accent',''));
  out_j := out_j || jsonb_build_object('accent',
    case when u ~ '^#[0-9A-Fa-f]{6}$' then upper(u) else '' end);

  out_j := out_j || jsonb_build_object('cta',
    case lower(coalesce(p->>'cta','')) when 'call' then 'call' else 'book' end);

  -- plain text, length-capped so no single field can blow up the page
  out_j := out_j || jsonb_build_object('tagline', left(btrim(coalesce(p->>'tagline','')), 90));
  out_j := out_j || jsonb_build_object('about',   left(btrim(coalesce(p->>'about','')), 600));
  out_j := out_j || jsonb_build_object('address', left(btrim(coalesce(p->>'address','')), 160));

  -- phone: keep only characters a dialer accepts
  out_j := out_j || jsonb_build_object('phone',
    left(regexp_replace(coalesce(p->>'phone',''), '[^0-9+()\- .]', '', 'g'), 24));

  -- handles: no @, no slashes, no protocol — we build the URL ourselves
  out_j := out_j || jsonb_build_object('ig',
    left(regexp_replace(coalesce(p->>'ig',''), '[^A-Za-z0-9._]', '', 'g'), 40));
  out_j := out_j || jsonb_build_object('tiktok',
    left(regexp_replace(coalesce(p->>'tiktok',''), '[^A-Za-z0-9._]', '', 'g'), 40));

  -- a URL is kept only if it is plainly http(s); javascript:, data:, vbscript:,
  -- a protocol-relative //evil.com and a bare word are all dropped
  foreach k in array array['maps','hero','logo'] loop
    u := btrim(coalesce(p->>k, ''));
    if u !~* '^https?://[^\s]' then u := ''; end if;
    out_j := out_j || jsonb_build_object(k, left(u, 500));
  end loop;

  -- up to 6 gallery photos, same URL rule
  if jsonb_typeof(coalesce(p->'photos','null'::jsonb)) = 'array' then
    for u in select jsonb_array_elements_text(p->'photos') loop
      exit when n >= 6;
      u := btrim(coalesce(u,''));
      if u ~* '^https?://[^\s]' then ph := ph || to_jsonb(left(u,500)); n := n + 1; end if;
    end loop;
  end if;
  out_j := out_j || jsonb_build_object('photos', ph);

  -- up to 3 extra buttons the shop names itself (gift cards, a product, a
  -- second location). Both halves must survive or the pair is dropped: a
  -- labelled button with no URL is a dead tap, and a URL with no label
  -- renders as an empty box.
  n := 0;
  if jsonb_typeof(coalesce(p->'buttons','null'::jsonb)) = 'array' then
    for e in select jsonb_array_elements(p->'buttons') loop
      exit when n >= 3;
      if jsonb_typeof(e) = 'object' then
        lbl := left(btrim(coalesce(e->>'label','')), 28);
        u   := btrim(coalesce(e->>'url',''));
        if lbl <> '' and u ~* '^https?://[^\s]' then
          bt := bt || jsonb_build_object('label', lbl, 'url', left(u,500));
          n := n + 1;
        end if;
      end if;
    end loop;
  end if;
  out_j := out_j || jsonb_build_object('buttons', bt);

  out_j := out_j || jsonb_build_object('team',
    lower(coalesce(p->>'team','')) in ('true','t','1','yes','on'));
  -- these three default to ON: they are the sections that make the page worth
  -- having, and a shop that never opened the editor should still get them
  out_j := out_j || jsonb_build_object('prices',
    lower(coalesce(p->>'prices','true')) in ('true','t','1','yes','on'));
  out_j := out_j || jsonb_build_object('reviews',
    lower(coalesce(p->>'reviews','true')) in ('true','t','1','yes','on'));
  out_j := out_j || jsonb_build_object('sms',
    lower(coalesce(p->>'sms','true')) in ('true','t','1','yes','on'));

  return out_j;
end $$;

-- ----------------------------------------------------------------------------
-- THE PAGE BODY. Whitelist only — see the header. Deliberately NOT granted to
-- anon: it skips the published check, so only the two wrappers below may call
-- it, and each applies its own gate first.
-- ----------------------------------------------------------------------------
create or replace function public.shop_site_payload(p_client text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; b public.booking_shops; st jsonb; c text; bname text;
        team jsonb := '[]'::jsonb; e jsonb;
        rv jsonb := '[]'::jsonb; rn int := 0; ravg numeric := 0;
begin
  c := lower(btrim(coalesce(p_client,'')));
  select * into s from public.reward_settings where client = c;
  if not found then return jsonb_build_object('error','no shop'); end if;
  select * into b from public.booking_shops where slug = c;
  st := public.site_sanitize(coalesce(s.site, '{}'::jsonb));
  bname := coalesce(nullif(s.biz_name,''), initcap(c));

  -- names only, never the staff phone, and only if the team section is on
  if coalesce((st->>'team')::boolean,false) and jsonb_typeof(coalesce(s.staff,'null'::jsonb))='array' then
    for e in select jsonb_array_elements(s.staff) loop
      if coalesce(e->>'name','') <> '' then
        team := team || jsonb_build_object('name', left(e->>'name', 40));
      end if;
    end loop;
  end if;

  -- The shop's OWN reviews, already collected by Loop and already approved by
  -- the owner. Same correlation as get_reviews_public: rows written before the
  -- client column existed are matched on the business name instead. Only the
  -- reviewer's first name goes out — never the phone or the member code.
  if coalesce((st->>'reviews')::boolean,true) then
    select count(*), coalesce(round(avg(rating)::numeric,1),0)
      into rn, ravg
      from public.reviews r
     where r.approved and (r.client = s.client or (r.client is null and lower(r.business)=lower(bname)));
    select coalesce(jsonb_agg(x),'[]'::jsonb) into rv from (
      select jsonb_build_object(
               'name',   left(split_part(coalesce(r.name,''),' ',1), 24),
               'rating', r.rating,
               'text',   left(r.text, 260)) as x
        from public.reviews r
       where r.approved and coalesce(r.text,'') <> ''
         and (r.client = s.client or (r.client is null and lower(r.business)=lower(bname)))
       order by r.rating desc nulls last, r.created_at desc
       limit 3
    ) t;
  end if;

  return jsonb_build_object(
    'published',  true,
    'client',     c,
    'biz_name',   bname,
    'reward_text',s.reward_text,
    'reward_at',  s.reward_at,
    'booking_on', coalesce(s.booking_on,false),
    'book_url',   s.book_url,
    'google_review_url', s.google_review_url,
    'services',   case when coalesce((st->>'prices')::boolean,true)
                       then coalesce(s.services,'[]'::jsonb) else '[]'::jsonb end,
    'hours',      coalesce(s.hours,'{}'::jsonb),
    'tz',         coalesce(s.book_tz,'America/New_York'),
    'team',       team,
    'rating',     ravg,
    'reviews_n',  rn,
    'reviews',    rv,
    -- booking_shops is the older store; fall back to it so a shop that filled
    -- in its address there does not have to type it twice
    'address',    nullif(coalesce(nullif(st->>'address',''), b.address, ''), ''),
    'phone',      nullif(coalesce(nullif(st->>'phone',''),   b.phone,   ''), ''),
    'site',       st
  );
end $$;

revoke execute on function public.shop_site_payload(text) from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- PUBLIC READ. Anon, no PIN. Refuses to hand out the body until the shop has
-- switched the site on AND the account is still live, and says so plainly
-- rather than 404-ing so the page can show "coming soon" instead of an error.
-- ----------------------------------------------------------------------------
create or replace function public.shop_site(p_client text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; st jsonb; c text;
begin
  c := lower(btrim(coalesce(p_client,'')));
  if c = '' then return jsonb_build_object('error','no shop'); end if;
  select * into s from public.reward_settings where client = c;
  if not found then return jsonb_build_object('error','no shop'); end if;
  st := public.site_sanitize(coalesce(s.site, '{}'::jsonb));
  if coalesce((st->>'on')::boolean,false) = false or coalesce(s.is_active,true) = false then
    return jsonb_build_object('published', false, 'biz_name', coalesce(s.biz_name, initcap(c)));
  end if;
  return public.shop_site_payload(c);
end $$;

revoke all on function public.shop_site(text) from public;
grant execute on function public.shop_site(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- OWNER PREVIEW. The same payload behind the PIN, ignoring the published gate,
-- so the editor can show the shop its site before anyone else can see it.
-- ----------------------------------------------------------------------------
create or replace function public.shop_site_admin(p_client text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings;
begin
  select * into s from public.reward_settings where client = lower(btrim(coalesce(p_client,'')));
  if not found then return jsonb_build_object('ok',false,'error','No program.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;
  return jsonb_build_object('ok',true,'data',public.shop_site_payload(s.client));
end $$;

revoke all on function public.shop_site_admin(text,text) from public;
grant execute on function public.shop_site_admin(text,text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- OWNER WRITE. Same PIN discipline as every other owner RPC: pin_gate() first
-- (it throttles and raises only on an active lock, writing nothing), then the
-- caller's own comparison returns the ordinary refusal so the throttle's
-- counter increment survives the transaction.
-- ----------------------------------------------------------------------------
create or replace function public.shop_site_set(p_client text, p_pin text, p_site jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; clean jsonb;
begin
  select * into s from public.reward_settings where client = lower(btrim(coalesce(p_client,'')));
  if not found then return jsonb_build_object('ok',false,'error','No program.'); end if;
  perform public.pin_gate(p_client, p_pin, s.pin);
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;
  clean := public.site_sanitize(p_site);
  update public.reward_settings set site = clean where client = lower(btrim(p_client));
  return jsonb_build_object('ok',true,'site',clean);
end $$;

revoke all on function public.shop_site_set(text,text,jsonb) from public;
grant execute on function public.shop_site_set(text,text,jsonb) to anon, authenticated;

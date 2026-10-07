-- Finder: on-demand lead scanner inside HQ.
--
-- Type a trade and a town, tap Scan, and the hq-finder edge function pulls the shops from
-- Google Places, opens each one's website, grades it (no site / no booking / breaks on a
-- phone / no SSL / stale), scores it with the Prospector's rules and hands back a ranked
-- list with a spoken opener and an estimated $/mo. This file is the database half:
-- saving the Google key from HQ, and importing what the scan found into the call list
-- without ever touching a row Nick has already worked.
--
-- Run after 009_hq_do_not_call.sql. Idempotent.

-- ---------- config from HQ ----------
-- The Google Places key lives in rx_config (service-role only). HQ writes it through here
-- so it never has to be pasted into the SQL editor. Values are never read back to the browser.
create or replace function public.hq_set_config(p_key text, p_value text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if p_key is null or p_key !~ '^[A-Z0-9_]{3,64}$' then raise exception 'bad key'; end if;
  if nullif(trim(coalesce(p_value,'')),'') is null then
    delete from public.rx_config where key = p_key;
    return false;
  end if;
  insert into public.rx_config(key, value) values (p_key, trim(p_value))
    on conflict (key) do update set value = excluded.value;
  return true;
end $$;

-- Which keys exist (names only), so HQ can show "key saved" without seeing the secret.
create or replace function public.hq_config_keys()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin()
    then (select coalesce(jsonb_agg(key order by key), '[]') from public.rx_config)
    else null end
$$;

grant execute on function public.hq_set_config(text, text) to authenticated;
grant execute on function public.hq_config_keys() to authenticated;

-- ---------- import a scan ----------
-- p_rows: the array the edge function returns (one object per shop). Rules:
--   * blocked (Dead before) → skipped, same as the Prospector
--   * already in the table and worked (anything but new/parked) → only the audit is refreshed
--   * already in the table and new/parked → audit, score, why, pitch refreshed
--   * otherwise inserted: 50+ → 'new' (on Today), under 50 → 'parked'
-- Returns counts so the Finder can say exactly what happened.
create or replace function public.hq_finder_import(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  existing public.rx_prospects;
  n_ins int := 0; n_upd int := 0; n_blocked int := 0; n_worked int := 0;
  v_score int; v_status text;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    if rx_is_blocked(r->>'phone', r->>'google_place_id') then
      n_blocked := n_blocked + 1; continue;
    end if;
    v_score := greatest(0, least(100, coalesce((r->>'score')::int, 0)));
    v_status := case when v_score >= 50 then 'new' else 'parked' end;

    select * into existing from public.rx_prospects
      where (r->>'google_place_id' is not null and google_place_id = r->>'google_place_id')
         or (r->>'phone' is not null and phone = r->>'phone')
      limit 1;

    if found then
      if existing.status in ('new','parked') then
        update public.rx_prospects set
          rating = coalesce((r->>'rating')::numeric, rating),
          reviews = coalesce((r->>'reviews')::int, reviews),
          website = coalesce(r->>'website', website),
          hours_note = coalesce(r->>'hours_note', hours_note),
          signals = coalesce(r->'signals', signals),
          score = v_score,
          status = v_status,
          why = coalesce(nullif(r->>'why',''), why),
          pitch = coalesce(nullif(r->>'pitch',''), pitch),
          audit = coalesce(r->'audit', audit),
          audited_at = now()
        where id = existing.id;
        n_upd := n_upd + 1;
      else
        -- Nick is already on this one. Leave his status, notes and callbacks alone.
        update public.rx_prospects set audit = coalesce(r->'audit', audit), audited_at = now()
          where id = existing.id;
        n_worked := n_worked + 1;
      end if;
      continue;
    end if;

    insert into public.rx_prospects
      (name, trade, phone, website, address, city, zip, rating, reviews, hours_note,
       google_place_id, signals, score, why, pitch, status, source, audit, audited_at)
    values
      (r->>'name', r->>'trade', r->>'phone', r->>'website', r->>'address', r->>'city', r->>'zip',
       (r->>'rating')::numeric, (r->>'reviews')::int, r->>'hours_note',
       r->>'google_place_id', coalesce(r->'signals','{}'::jsonb), v_score,
       r->>'why', r->>'pitch', v_status, 'finder', r->'audit', now());
    n_ins := n_ins + 1;
  end loop;

  return jsonb_build_object('inserted', n_ins, 'updated', n_upd, 'blocked', n_blocked, 'already_working', n_worked);
end $$;

grant execute on function public.hq_finder_import(jsonb) to authenticated;

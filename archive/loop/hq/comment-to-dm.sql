-- Loop Command Center — Comment → DM automation.
-- Someone comments a keyword on the shop's Instagram post, Loop instantly DMs them.
--
-- Three tables:
--   dm_accounts  one row per connected Instagram Business account (maps IG id -> Loop client)
--   dm_triggers  the shop's keyword rules (keyword -> DM body)
--   dm_log       every fired comment; the unique index on comment_id is the dedupe
--
-- Two audiences for the RPCs:
--   owner-facing (anon key, gated on client+PIN) — list / save / delete / toggle rules
--   server-facing (service_role only) — dm_claim / dm_finish, called by api/ig-webhook.js.
--   dm_claim returns the page access token, so it is REVOKED from anon/authenticated.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.dm_accounts (
  ig_user_id  text primary key,          -- Instagram Business account id (entry[].id on the webhook)
  client      text not null,             -- reward_settings.client
  ig_username text,
  page_id     text,
  page_token  text,                      -- per-shop token; falls back to the IG_PAGE_TOKEN env var
  connected_at timestamptz not null default now()
);
create index if not exists dm_accounts_client_idx on public.dm_accounts(client);

create table if not exists public.dm_triggers (
  id           uuid primary key default gen_random_uuid(),
  client       text not null,
  keyword      text not null default '',
  match        text not null default 'contains',   -- contains | exact | any
  message      text not null,                      -- the DM body (<= 900 chars)
  link         text,                               -- appended to the DM on its own line
  public_reply text,                               -- optional public reply under the comment
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists dm_triggers_client_idx on public.dm_triggers(client, active);

create table if not exists public.dm_log (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  client         text,
  trigger_id     uuid,
  platform       text not null default 'instagram',  -- instagram | facebook
  comment_id     text,
  commenter_id   text,
  commenter_name text,
  comment_text   text,
  status         text not null default 'pending',    -- pending | sent | error
  error          text
);
-- One DM per comment, forever. NULLs don't collide, so non-comment rows are unaffected.
create unique index if not exists dm_log_comment_uniq on public.dm_log(comment_id);
create index if not exists dm_log_client_idx on public.dm_log(client, at desc);
create index if not exists dm_log_trigger_idx on public.dm_log(trigger_id) where status = 'sent';

alter table public.dm_accounts enable row level security;
alter table public.dm_triggers enable row level security;
alter table public.dm_log      enable row level security;
-- No public policies on purpose: everything goes through the RPCs below.

-- ---------------------------------------------------------------- owner RPCs

create or replace function public.dm_triggers_list(p_client text, p_pin text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; acct public.dm_accounts; rules jsonb; recent jsonb; total int;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if not found then return jsonb_build_object('ok',false,'error','No program.'); end if;
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;

  select * into acct from public.dm_accounts where client = lower(p_client) limit 1;

  select coalesce(jsonb_agg(r order by r.created_at), '[]'::jsonb) into rules
  from (
    select t.id, t.keyword, t.match, t.message, t.link, t.public_reply, t.active, t.created_at,
           (select count(*) from public.dm_log l where l.trigger_id = t.id and l.status = 'sent') as sent
    from public.dm_triggers t where t.client = lower(p_client)
  ) r;

  select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) into recent
  from (
    select l.at, l.commenter_name, l.comment_text, l.status, l.error
    from public.dm_log l where l.client = lower(p_client) order by l.at desc limit 15
  ) x;

  select count(*) into total from public.dm_log where client = lower(p_client) and status = 'sent';

  return jsonb_build_object(
    'ok', true,
    'connected', acct.ig_user_id is not null,
    'ig_username', acct.ig_username,
    'triggers', rules,
    'recent', recent,
    'sent_total', total
  );
end $$;

create or replace function public.dm_trigger_save(
  p_client text, p_pin text, p_id uuid, p_keyword text, p_message text,
  p_link text, p_public_reply text, p_match text, p_active boolean
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; v_id uuid; v_match text; v_kw text; n int;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if not found then return jsonb_build_object('ok',false,'error','No program.'); end if;
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;

  v_match := case when p_match in ('contains','exact','any') then p_match else 'contains' end;
  v_kw := btrim(coalesce(p_keyword,''));
  if v_match <> 'any' and v_kw = '' then
    return jsonb_build_object('ok',false,'error','Give the rule a keyword.');
  end if;
  if btrim(coalesce(p_message,'')) = '' then
    return jsonb_build_object('ok',false,'error','Write the DM you want sent.');
  end if;
  if length(p_message) > 900 then
    return jsonb_build_object('ok',false,'error','Instagram caps a DM at about 900 characters.');
  end if;

  if p_id is not null then
    update public.dm_triggers
       set keyword = v_kw, match = v_match, message = p_message,
           link = nullif(btrim(coalesce(p_link,'')),''),
           public_reply = nullif(btrim(coalesce(p_public_reply,'')),''),
           active = coalesce(p_active, true)
     where id = p_id and client = lower(p_client)
     returning id into v_id;
    if v_id is null then return jsonb_build_object('ok',false,'error','Rule not found.'); end if;
  else
    select count(*) into n from public.dm_triggers where client = lower(p_client);
    if n >= 25 then return jsonb_build_object('ok',false,'error','25 rules is the limit.'); end if;
    insert into public.dm_triggers(client, keyword, match, message, link, public_reply, active)
    values (lower(p_client), v_kw, v_match, p_message,
            nullif(btrim(coalesce(p_link,'')),''),
            nullif(btrim(coalesce(p_public_reply,'')),''),
            coalesce(p_active, true))
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.dm_trigger_delete(p_client text, p_pin text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s public.reward_settings; n int;
begin
  select * into s from public.reward_settings where client = lower(coalesce(p_client,''));
  if not found then return jsonb_build_object('ok',false,'error','No program.'); end if;
  if coalesce(s.pin,'') = '' or coalesce(p_pin,'') <> s.pin then
    return jsonb_build_object('ok',false,'error','Wrong PIN.');
  end if;
  delete from public.dm_triggers where id = p_id and client = lower(p_client);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0, 'deleted', n);
end $$;

-- ---------------------------------------------------------------- server RPCs

-- Resolve the account, pick the first matching active rule, and atomically claim the
-- comment so a Meta webhook retry can never DM the same person twice.
create or replace function public.dm_claim(
  p_ig_user_id text, p_platform text, p_comment_id text,
  p_commenter_id text, p_commenter_name text, p_text text
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare acct public.dm_accounts; t public.dm_triggers; v_txt text; v_log bigint;
begin
  if coalesce(p_comment_id,'') = '' then
    return jsonb_build_object('ok',false,'reason','no comment id');
  end if;

  select * into acct from public.dm_accounts where ig_user_id = p_ig_user_id;
  if not found then return jsonb_build_object('ok',false,'reason','account not connected'); end if;

  -- Never reply to the shop's own comments.
  if p_commenter_id = acct.ig_user_id then
    return jsonb_build_object('ok',false,'reason','own comment');
  end if;

  v_txt := lower(btrim(coalesce(p_text,'')));
  select * into t from public.dm_triggers
   where client = acct.client and active
     and ( match = 'any'
        or (match = 'exact'    and v_txt = lower(btrim(keyword)))
        or (match = 'contains' and v_txt like '%' || lower(btrim(keyword)) || '%') )
   order by (match = 'any'), created_at
   limit 1;
  if not found then return jsonb_build_object('ok',false,'reason','no keyword match'); end if;

  insert into public.dm_log(client, trigger_id, platform, comment_id, commenter_id,
                            commenter_name, comment_text, status)
  values (acct.client, t.id, coalesce(p_platform,'instagram'), p_comment_id, p_commenter_id,
          p_commenter_name, left(coalesce(p_text,''), 500), 'pending')
  on conflict (comment_id) do nothing
  returning id into v_log;
  if v_log is null then return jsonb_build_object('ok',false,'reason','already handled'); end if;

  return jsonb_build_object(
    'ok', true, 'log_id', v_log, 'client', acct.client,
    'page_token', acct.page_token, 'page_id', acct.page_id,
    'message', t.message, 'link', t.link, 'public_reply', t.public_reply
  );
end $$;

create or replace function public.dm_finish(p_log_id bigint, p_status text, p_error text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  update public.dm_log
     set status = case when p_status in ('sent','error') then p_status else 'error' end,
         error  = left(nullif(coalesce(p_error,''),''), 500)
   where id = p_log_id;
  return jsonb_build_object('ok', true);
end $$;

-- dm_claim hands back the page access token, so it must never be reachable with the anon key.
revoke all on function public.dm_claim(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.dm_finish(bigint,text,text)              from public, anon, authenticated;
grant execute on function public.dm_claim(text,text,text,text,text,text) to service_role;
grant execute on function public.dm_finish(bigint,text,text)             to service_role;

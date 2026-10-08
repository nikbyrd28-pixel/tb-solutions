-- CLIP ENGINE — one livestream in, 2 longform + LinkedIn + X + 5 shorts x 3 platforms out.
-- Prefix: clip_. Review page: tbsol.net/clips/ (HQ admins only, via is_hq_admin()).
-- Worker (clips/worker) uses the service key and talks to these tables directly.

create extension if not exists pgcrypto;

-- A source = one livestream VOD (or any long video)
create table if not exists public.clip_sources (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  platform      text not null default 'youtube',
  video_id      text,
  title         text,
  duration_s    int,
  was_live      boolean,
  status        text not null default 'new',   -- new | downloading | transcribing | selecting | cutting | ready | error | skipped
  stage_note    text,
  transcript    jsonb,                          -- [{s,e,t}] sentence-level
  plan          jsonb,                          -- the AI's pick list (what it chose and why)
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- An item = one rendered file that goes to one or more platforms
create table if not exists public.clip_items (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.clip_sources(id) on delete cascade,
  seq           int not null,                   -- order inside the source
  kind          text not null,                  -- longform | linkedin | x | short
  platforms     text[] not null,                -- e.g. {youtube} | {linkedin} | {twitter} | {youtube,instagram,facebook,tiktok}
  start_s       numeric not null,
  end_s         numeric not null,
  title         text,
  caption       text,                           -- body text / description used for the post
  hashtags      text[],
  hook          text,                           -- first on-screen line for shorts
  why           text,                           -- AI's one-line reason this was picked
  file_url      text,                           -- public URL in the uploads bucket
  thumb_url     text,
  status        text not null default 'queued', -- queued | rendering | rendered | approved | posting | posted | skipped | error
  publish_at    timestamptz,                    -- when the publisher may post it (staggered by the worker)
  post_ids      jsonb,                          -- {platform: id/url} back from the publisher
  publish_error text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists clip_items_status_idx on public.clip_items(status, publish_at);
create index if not exists clip_items_source_idx on public.clip_items(source_id, seq);

create or replace function public.clip_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists clip_sources_touch on public.clip_sources;
create trigger clip_sources_touch before update on public.clip_sources for each row execute function public.clip_touch();
drop trigger if exists clip_items_touch on public.clip_items;
create trigger clip_items_touch before update on public.clip_items for each row execute function public.clip_touch();

alter table public.clip_sources enable row level security;
alter table public.clip_items   enable row level security;
-- No direct policies: the page goes through the admin RPCs below, the worker uses the service key.

-- ---------- Admin RPCs (page) ----------
create or replace function public.clip_admin_sources(p_limit int default 30)
returns setof public.clip_sources language sql stable security definer set search_path = public as $$
  select * from public.clip_sources
  where public.is_hq_admin()
  order by created_at desc limit p_limit
$$;

create or replace function public.clip_admin_items(p_source uuid)
returns setof public.clip_items language sql stable security definer set search_path = public as $$
  select * from public.clip_items
  where public.is_hq_admin() and source_id = p_source
  order by seq
$$;

create or replace function public.clip_inbox()
returns setof public.clip_items language sql stable security definer set search_path = public as $$
  select * from public.clip_items
  where public.is_hq_admin() and status in ('rendered','approved','posting','error')
  order by coalesce(publish_at, created_at)
$$;

create or replace function public.clip_add_source(p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  insert into public.clip_sources(url) values (trim(p_url))
    on conflict (url) do update set status = case when clip_sources.status in ('error','skipped') then 'new' else clip_sources.status end
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.clip_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  if p_status not in ('approved','skipped','rendered','queued') then raise exception 'bad status'; end if;
  update public.clip_items set status = p_status, publish_error = null,
    publish_at = case when p_status = 'approved' then coalesce(publish_at, now()) else publish_at end
  where id = p_id;
end $$;

create or replace function public.clip_approve_source(p_source uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  update public.clip_items set status = 'approved', publish_at = coalesce(publish_at, now())
  where source_id = p_source and status = 'rendered';
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.clip_update(p_id uuid, p_title text, p_caption text, p_publish_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  update public.clip_items set title = coalesce(p_title,title), caption = coalesce(p_caption,caption),
    publish_at = coalesce(p_publish_at, publish_at) where id = p_id;
end $$;

create or replace function public.clip_source_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hq_admin() then raise exception 'not admin'; end if;
  if p_status not in ('new','skipped') then raise exception 'bad status'; end if;
  update public.clip_sources set status = p_status, last_error = null where id = p_id;
end $$;

grant execute on function public.clip_admin_sources(int), public.clip_admin_items(uuid), public.clip_inbox(),
  public.clip_add_source(text), public.clip_set_status(uuid,text), public.clip_approve_source(uuid),
  public.clip_update(uuid,text,text,timestamptz), public.clip_source_status(uuid,text) to authenticated;

-- Make sure the public uploads bucket exists (worker writes clips/<source>/<item>.mp4 there)
insert into storage.buckets (id, name, public) values ('uploads','uploads', true) on conflict (id) do nothing;

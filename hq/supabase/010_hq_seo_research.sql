-- SEO research the agent leaves behind: keywords worth a page (seo_keywords) and links worth
-- asking for (seo_links). HQ shows links as a to-do with a Done button; keywords feed the build.
-- Run after 009_hq_do_not_call.sql. Idempotent.
create table if not exists public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique, intent text, evidence text, target_page text,
  priority int not null default 50,
  status text not null default 'new' check (status in ('new','building','live','skip')),
  found_at timestamptz not null default now()
);
alter table public.seo_keywords enable row level security;
create table if not exists public.seo_links (
  id uuid primary key default gen_random_uuid(),
  site text not null, url text not null unique, kind text, why text, how text, cost text,
  priority int not null default 50,
  status text not null default 'todo' check (status in ('todo','submitted','live','rejected','skip')),
  found_at timestamptz not null default now(), done_at timestamptz
);
alter table public.seo_links enable row level security;
create or replace function public.hq_seo() returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'keywords', (select coalesce(jsonb_agg(to_jsonb(k) order by (k.status='new') desc, k.priority desc, k.found_at desc), '[]') from seo_keywords k),
    'links', (select coalesce(jsonb_agg(to_jsonb(l) order by (l.status='todo') desc, l.priority desc, l.found_at desc), '[]') from seo_links l)
  ) else null end
$$;
create or replace function public.hq_seo_link_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update seo_links set status = p_status, done_at = case when p_status in ('submitted','live') then now() else null end where id = p_id;
end $$;
create or replace function public.hq_seo_keyword_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update seo_keywords set status = p_status where id = p_id;
end $$;
grant execute on function public.hq_seo(), public.hq_seo_link_status(uuid,text), public.hq_seo_keyword_status(uuid,text) to authenticated;
revoke execute on function public.hq_seo(), public.hq_seo_link_status(uuid,text), public.hq_seo_keyword_status(uuid,text) from anon;

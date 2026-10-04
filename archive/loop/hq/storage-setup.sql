-- ============================================================
-- TB Command — File uploads (storage bucket)
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- ============================================================

-- Public bucket for client-uploaded screenshots & files.
insert into storage.buckets (id, name, public)
values ('uploads','uploads', true)
on conflict (id) do nothing;

-- Anyone can upload into it (10MB limit is enforced by the pages).
drop policy if exists "anyone can upload to uploads" on storage.objects;
create policy "anyone can upload to uploads" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'uploads');

-- Anyone with the link can view a file (needed so you can open them).
drop policy if exists "public read uploads" on storage.objects;
create policy "public read uploads" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'uploads');

-- No one can overwrite or delete via the public key (immutable uploads).

-- ---------- also: let the admin update intakes (convert / mark done) ----------
drop policy if exists "admin manages intakes" on public.intakes;
create policy "admin manages intakes" on public.intakes
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ============================================================
-- PROSPECTS — every new client-portal signup lands here so the
-- admin sees who created an account (a "prospect" before they're a
-- full client). Public/authenticated INSERT + admin read/manage.
-- ============================================================
create table if not exists public.prospects (
  id         bigint generated always as identity primary key,
  email      text,
  name       text,
  source     text default 'portal signup',
  status     text default 'New',
  created_at timestamptz not null default now()
);
alter table public.prospects enable row level security;

drop policy if exists "anyone can create a prospect" on public.prospects;
create policy "anyone can create a prospect" on public.prospects
  for insert to anon, authenticated with check (true);

drop policy if exists "admin reads prospects" on public.prospects;
create policy "admin reads prospects" on public.prospects
  for select to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

drop policy if exists "admin manages prospects" on public.prospects;
create policy "admin manages prospects" on public.prospects
  for update to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

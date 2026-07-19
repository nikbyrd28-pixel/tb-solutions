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

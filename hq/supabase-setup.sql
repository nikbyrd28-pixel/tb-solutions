-- ============================================================
-- TB Command Center — Supabase setup
-- Run this once in your Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste all of this → Run
-- ============================================================

-- One simple table holds all your data, private to each logged-in user.
create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  value   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Turn on Row Level Security so nobody can read anyone else's data.
alter table public.kv enable row level security;

-- Each user can only see and change their own rows.
drop policy if exists "own rows" on public.kv;
create policy "own rows" on public.kv
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Done. Now:
-- 1) Project Settings → API → copy the "Project URL" and the "anon public" key.
-- 2) Paste them into hq/index.html at the top of the script (SUPA_URL and SUPA_KEY).
-- 3) Authentication → Providers → make sure "Email" is enabled.
--    (Optional: turn OFF "Confirm email" for instant login while it's just you.)
-- 4) Open your site /hq, click "Create your account", and log in. That's it.

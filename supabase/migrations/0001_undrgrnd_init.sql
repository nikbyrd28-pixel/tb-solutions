-- UNDRGRND schema — applied to its own dedicated Supabase project
-- (avcslzbglebvrlywnevb), NOT to Loop's production project
-- (qgbjiqdwzgkjkmqyjsmc). Kept here for reference/reproducibility only.

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  is_curator boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- tracks
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  source text not null check (source in ('soundcloud','youtube','bandcamp','other')),
  embed_url text not null,
  external_url text,
  cover_image_url text,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "Tracks are viewable by everyone"
  on public.tracks for select using (true);

create policy "Curators can insert tracks"
  on public.tracks for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_curator = true)
  );

create policy "Curators can update tracks"
  on public.tracks for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_curator = true)
  );

-- drops
create table public.drops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  curator_id uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.drops enable row level security;

create policy "Published drops are viewable by everyone, drafts by their curator"
  on public.drops for select using (
    published_at is not null
    or curator_id = auth.uid()
  );

create policy "Curators can insert drops"
  on public.drops for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_curator = true)
  );

create policy "Curators can update own drops"
  on public.drops for update using (curator_id = auth.uid());

-- drop_tracks
create table public.drop_tracks (
  drop_id uuid references public.drops(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete cascade,
  position int not null default 0,
  primary key (drop_id, track_id)
);

alter table public.drop_tracks enable row level security;

create policy "Drop tracks follow drop visibility"
  on public.drop_tracks for select using (
    exists (
      select 1 from public.drops d
      where d.id = drop_id
      and (d.published_at is not null or d.curator_id = auth.uid())
    )
  );

create policy "Curators can insert drop tracks"
  on public.drop_tracks for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_curator = true)
  );

create policy "Curators can delete drop tracks"
  on public.drop_tracks for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_curator = true)
  );

-- saves
create table public.saves (
  user_id uuid references public.profiles(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

alter table public.saves enable row level security;

create policy "Users can view own saves"
  on public.saves for select using (auth.uid() = user_id);

create policy "Users can insert own saves"
  on public.saves for insert with check (auth.uid() = user_id);

create policy "Users can delete own saves"
  on public.saves for delete using (auth.uid() = user_id);

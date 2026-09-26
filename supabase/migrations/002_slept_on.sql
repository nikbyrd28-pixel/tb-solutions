-- Slept On — underground rap drops inside Nick Byrd TV
-- Weekly hand-picked drops, fire reactions, artist submissions.

-- ---------- drops ----------
create table if not exists nb_drops (
  id uuid primary key default gen_random_uuid(),
  number int unique not null check (number > 0),
  title text,
  blurb text,
  status text not null default 'draft' check (status in ('draft','live')),
  published_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- tracks ----------
create table if not exists nb_tracks (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references nb_drops(id) on delete cascade,
  position int not null default 1,
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) between 1 and 120),
  artist_url text,                  -- IG / SoundCloud profile
  city text,                        -- scene tag: Philly, Houston, Detroit…
  link_url text not null,           -- where it lives: SoundCloud / YouTube / Audiomack / Spotify / mp3
  cover_url text,
  note text,                        -- why it made the drop
  fire_count int not null default 0,
  submission_id uuid,
  created_at timestamptz default now()
);
create index if not exists nb_tracks_drop on nb_tracks (drop_id, position);

create table if not exists nb_track_fires (
  track_id uuid references nb_tracks(id) on delete cascade,
  session_id text not null,
  created_at timestamptz default now(),
  primary key (track_id, session_id)
);

-- ---------- artist submissions ----------
create table if not exists nb_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 5 and 254),
  artist text not null check (char_length(artist) between 1 and 120),
  handle text check (handle is null or char_length(handle) <= 80),
  city text check (city is null or char_length(city) <= 80),
  link_url text not null check (char_length(link_url) between 8 and 500),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new','picked','pass')),
  created_at timestamptz default now()
);
create index if not exists nb_submissions_status on nb_submissions (status, created_at desc);

-- ---------- rpc: one fire per track per device ----------
create or replace function nb_fire_track(p_track_id uuid, p_session text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_session is null or char_length(p_session) < 8 then raise exception 'session'; end if;
  insert into nb_track_fires (track_id, session_id) values (p_track_id, left(p_session, 64))
    on conflict do nothing;
  if found then
    update nb_tracks set fire_count = fire_count + 1 where id = p_track_id returning fire_count into n;
  else
    select fire_count into n from nb_tracks where id = p_track_id;
  end if;
  return coalesce(n, 0);
end $$;

-- ---------- RLS ----------
alter table nb_drops enable row level security;
alter table nb_tracks enable row level security;
alter table nb_track_fires enable row level security;
alter table nb_submissions enable row level security;

create policy "live drops readable" on nb_drops for select using (status = 'live' or nb_is_admin());
create policy "admin all drops" on nb_drops for all using (nb_is_admin()) with check (nb_is_admin());

create policy "live tracks readable" on nb_tracks for select
  using (nb_is_admin() or exists (select 1 from nb_drops d where d.id = drop_id and d.status = 'live'));
create policy "admin all tracks" on nb_tracks for all using (nb_is_admin()) with check (nb_is_admin());

-- fires only via rpc (security definer); no direct access

create policy "anyone can submit" on nb_submissions for insert with check (status = 'new');
create policy "admin read submissions" on nb_submissions for select using (nb_is_admin());
create policy "admin update submissions" on nb_submissions for update using (nb_is_admin()) with check (nb_is_admin());
create policy "admin delete submissions" on nb_submissions for delete using (nb_is_admin());

grant execute on function nb_fire_track(uuid, text) to anon, authenticated;

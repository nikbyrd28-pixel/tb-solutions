-- Nick Byrd TV — schema
-- Run in Supabase SQL editor (project "Base") or via supabase db push

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists nb_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  tier text not null default 'free' check (tier in ('free','inner_circle','day_one')),
  created_at timestamptz default now()
);

create or replace function nb_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into nb_profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists nb_on_auth_user_created on auth.users;
create trigger nb_on_auth_user_created
  after insert on auth.users for each row execute function nb_handle_new_user();

-- ---------- videos ----------
create table if not exists nb_videos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  kind text not null default 'long' check (kind in ('long','short')),   -- long = YouTube-style, short = Chaos Feed
  video_url text not null,          -- Supabase Storage public URL / Bunny / Mux playback URL
  thumbnail_url text,
  duration_seconds int,
  visibility text not null default 'public' check (visibility in ('public','members','unlisted','draft')),
  min_tier text not null default 'free' check (min_tier in ('free','inner_circle','day_one')),
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  tags text[] default '{}',
  published_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists nb_videos_kind_pub on nb_videos (kind, published_at desc);

-- ---------- engagement ----------
create table if not exists nb_video_likes (
  video_id uuid references nb_videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (video_id, user_id)
);

create table if not exists nb_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references nb_videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  parent_id uuid references nb_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz default now()
);
create index if not exists nb_comments_video on nb_comments (video_id, created_at);

create table if not exists nb_video_views (
  id bigserial primary key,
  video_id uuid references nb_videos(id) on delete cascade,
  user_id uuid,
  session_id text,
  created_at timestamptz default now()
);

-- ---------- funnel ----------
create table if not exists nb_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text,           -- 'join', 'watch:<slug>', 'feed', etc.
  utm jsonb,
  created_at timestamptz default now(),
  unique (email)
);

create table if not exists nb_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tier text not null check (tier in ('inner_circle','day_one')),
  status text not null default 'active' check (status in ('active','canceled','past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- community posts (members-only wall)
create table if not exists nb_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  image_url text,
  min_tier text not null default 'free' check (min_tier in ('free','inner_circle','day_one')),
  created_at timestamptz default now()
);

-- ---------- rpc ----------
create or replace function nb_increment_view(p_video_id uuid, p_session text)
returns void language plpgsql security definer as $$
begin
  insert into nb_video_views (video_id, user_id, session_id) values (p_video_id, auth.uid(), p_session);
  update nb_videos set view_count = view_count + 1 where id = p_video_id;
end $$;

create or replace function nb_toggle_like(p_video_id uuid)
returns boolean language plpgsql security definer as $$
declare liked boolean;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if exists (select 1 from nb_video_likes where video_id = p_video_id and user_id = auth.uid()) then
    delete from nb_video_likes where video_id = p_video_id and user_id = auth.uid();
    update nb_videos set like_count = greatest(like_count - 1, 0) where id = p_video_id;
    liked := false;
  else
    insert into nb_video_likes (video_id, user_id) values (p_video_id, auth.uid());
    update nb_videos set like_count = like_count + 1 where id = p_video_id;
    liked := true;
  end if;
  return liked;
end $$;

-- ---------- RLS ----------
alter table nb_profiles enable row level security;
alter table nb_videos enable row level security;
alter table nb_video_likes enable row level security;
alter table nb_comments enable row level security;
alter table nb_video_views enable row level security;
alter table nb_leads enable row level security;
alter table nb_memberships enable row level security;
alter table nb_posts enable row level security;

create policy "profiles readable" on nb_profiles for select using (true);
create policy "own profile update" on nb_profiles for update using (auth.uid() = id);

create policy "public videos readable" on nb_videos for select
  using (visibility in ('public','unlisted','members'));
-- inserts/updates happen with the service role from the admin route only

create policy "likes readable" on nb_video_likes for select using (true);
create policy "comments readable" on nb_comments for select using (true);
create policy "comment as self" on nb_comments for insert with check (auth.uid() = user_id);
create policy "delete own comment" on nb_comments for delete using (auth.uid() = user_id);

create policy "anyone can subscribe" on nb_leads for insert with check (true);
create policy "own membership" on nb_memberships for select using (auth.uid() = user_id);

create policy "posts readable" on nb_posts for select using (true);

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('videos','videos', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('thumbnails','thumbnails', true) on conflict do nothing;

-- ---------- seed (delete after first real upload) ----------
insert into nb_videos (slug, title, description, kind, video_url, thumbnail_url, duration_seconds, view_count, like_count, tags) values
 ('live-boxing-match', 'LIVE BOXING MATCH', 'Backyard boxing in the Philly suburbs. It got real.', 'long',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://picsum.photos/seed/boxing/1280/720', 2004, 119, 14, '{boxing,irl,philly}'),
 ('best-girlfriend-ever', 'Best girlfriend ever', 'POV: she found the receipt.', 'short',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://picsum.photos/seed/gf/720/1280', 22, 347000, 21000, '{pov,funny}'),
 ('dont-apply-streamers-university', 'DON''T APPLY TO STREAMERS UNIVERSITY', 'A warning from the trenches.', 'short',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://picsum.photos/seed/su/720/1280', 41, 1666, 210, '{streaming,rant}'),
 ('road-to-10k', 'Road to 10K — Episode 1', 'Building my own platform so nobody can shadowban me. This is day one.', 'long',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://picsum.photos/seed/road/1280/720', 653, 4989, 402, '{vlog,builder}'),
 ('kiss-or-slap', 'Kiss or slap today', 'You already know how this went.', 'short',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://picsum.photos/seed/kiss/720/1280', 18, 8800, 900, '{pov,chaos}')
on conflict (slug) do nothing;

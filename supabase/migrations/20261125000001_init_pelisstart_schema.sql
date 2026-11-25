-- PelisStart initial schema: user profiles, favorites, watch history, advent progress, and global play stats

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  preferred_provider text not null default '',
  preferred_lang text not null default 'latino',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Cinéfilo'
  );
  insert into public.profiles (user_id, display_name)
  values (new.id, left(v_name, 80))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.user_favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id text not null,
  media_type text not null default 'movie' check (media_type in ('movie', 'serial')),
  title text not null,
  poster text not null default '',
  backdrop text not null default '',
  year text not null default '',
  rating text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create index if not exists idx_user_favorites_user_created
  on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;

create policy "Users can view own favorites"
  on public.user_favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own favorites"
  on public.user_favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own favorites"
  on public.user_favorites for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own favorites"
  on public.user_favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.user_watch_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id text not null,
  media_type text not null default 'movie' check (media_type in ('movie', 'serial')),
  title text not null,
  poster text not null default '',
  backdrop text not null default '',
  year text not null default '',
  rating text not null default '',
  duration text not null default '',
  last_season integer not null default 1 check (last_season >= 1),
  last_episode integer not null default 1 check (last_episode >= 1),
  watched_episodes jsonb not null default '[]'::jsonb,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  play_count integer not null default 1 check (play_count >= 1),
  media_data jsonb not null default '{}'::jsonb,
  last_watched_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create index if not exists idx_user_watch_history_user_recent
  on public.user_watch_history (user_id, last_watched_at desc);

alter table public.user_watch_history enable row level security;

create policy "Users can view own watch history"
  on public.user_watch_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own watch history"
  on public.user_watch_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own watch history"
  on public.user_watch_history for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own watch history"
  on public.user_watch_history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.user_advent_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null default 2025,
  day integer not null check (day >= 1 and day <= 24),
  media_id text not null default '',
  watched boolean not null default false,
  opened_at timestamptz not null default now(),
  unique (user_id, year, day)
);

create index if not exists idx_user_advent_user_year
  on public.user_advent_progress (user_id, year, day);

alter table public.user_advent_progress enable row level security;

create policy "Users can view own advent progress"
  on public.user_advent_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own advent progress"
  on public.user_advent_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own advent progress"
  on public.user_advent_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own advent progress"
  on public.user_advent_progress for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.media_play_stats (
  media_id text primary key,
  media_type text not null default 'movie' check (media_type in ('movie', 'serial')),
  title text not null,
  poster text not null default '',
  backdrop text not null default '',
  year text not null default '',
  rating text not null default '',
  duration text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  total_plays bigint not null default 1 check (total_plays >= 0),
  last_played_at timestamptz not null default now()
);

create index if not exists idx_media_play_stats_top
  on public.media_play_stats (total_plays desc, last_played_at desc);

alter table public.media_play_stats enable row level security;

create policy "Public can read media play stats"
  on public.media_play_stats for select
  to anon, authenticated
  using (true);

create table if not exists public.media_play_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  media_id text not null check (length(trim(media_id)) between 1 and 64),
  media_type text not null default 'movie' check (media_type in ('movie', 'serial')),
  title text not null check (length(trim(title)) between 1 and 240),
  poster text not null default '',
  backdrop text not null default '',
  year text not null default '',
  rating text not null default '',
  duration text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_play_events_media_created
  on public.media_play_events (media_id, created_at desc);

alter table public.media_play_events enable row level security;

create policy "Anyone can record a play event"
  on public.media_play_events for insert
  to anon, authenticated
  with check (
    length(trim(media_id)) between 1 and 64
    and length(trim(title)) between 1 and 240
    and media_type in ('movie', 'serial')
    and (user_id is null or user_id = (select auth.uid()))
  );

create or replace function public.sync_media_play_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_play_stats (
    media_id, media_type, title, poster, backdrop, year, rating, duration, metadata, total_plays, last_played_at
  )
  values (
    trim(new.media_id),
    new.media_type,
    left(trim(new.title), 240),
    left(coalesce(new.poster, ''), 500),
    left(coalesce(new.backdrop, ''), 500),
    left(coalesce(new.year, ''), 16),
    left(coalesce(new.rating, ''), 16),
    left(coalesce(new.duration, ''), 32),
    coalesce(new.metadata, '{}'::jsonb),
    1,
    now()
  )
  on conflict (media_id) do update
    set
      total_plays = public.media_play_stats.total_plays + 1,
      last_played_at = now(),
      title = case when length(excluded.title) > 0 then excluded.title else public.media_play_stats.title end,
      poster = case when length(excluded.poster) > 0 then excluded.poster else public.media_play_stats.poster end,
      backdrop = case when length(excluded.backdrop) > 0 then excluded.backdrop else public.media_play_stats.backdrop end,
      year = case when length(excluded.year) > 0 then excluded.year else public.media_play_stats.year end,
      rating = case when length(excluded.rating) > 0 then excluded.rating else public.media_play_stats.rating end,
      duration = case when length(excluded.duration) > 0 then excluded.duration else public.media_play_stats.duration end,
      metadata = case when excluded.metadata <> '{}'::jsonb then excluded.metadata else public.media_play_stats.metadata end;

  return new;
end;
$$;

create trigger on_media_play_event_insert
  after insert on public.media_play_events
  for each row execute function public.sync_media_play_stats();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_media_play_stats() from public, anon, authenticated;
create index if not exists idx_media_play_events_user_id
  on public.media_play_events (user_id);

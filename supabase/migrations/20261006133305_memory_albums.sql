-- SDD-05: user albums are only reached through authenticated, owner-filtered
-- server routes. The service key stays on the server; public Data API roles
-- receive no privileges on these tables.
create table public.memory_albums (
  id uuid primary key,
  owner_key text not null,
  request_id uuid not null,
  input_digest text not null check (length(input_digest) = 64),
  status text not null check (status in ('pending', 'ready', 'failed')),
  title text not null check (char_length(title) between 1 and 80),
  event_date date,
  caption text not null default '' check (char_length(caption) <= 300),
  memory_profile jsonb not null,
  selected_kind text not null check (selected_kind in ('ai', 'qq')),
  selected_track_id text not null,
  photo_count smallint not null check (photo_count between 1 and 9),
  error_code text,
  created_at timestamptz not null default now(),
  saved_at timestamptz,
  unique (owner_key, request_id)
);
create index memory_albums_owner_ready_created_idx
  on public.memory_albums (owner_key, created_at desc, id desc)
  where status = 'ready';

create table public.memory_album_photos (
  album_id uuid not null references public.memory_albums(id) on delete cascade,
  position smallint not null check (position between 0 and 8),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  primary key (album_id, position)
);

create table public.memory_album_music_versions (
  album_id uuid not null references public.memory_albums(id) on delete cascade,
  version_id text not null,
  kind text not null check (kind in ('ai', 'qq')),
  status text not null check (status in ('ready', 'failed', 'pending')),
  source text check (source in ('api', 'demo', 'mock')),
  title text,
  artist text,
  audio_url text,
  audio_mime_type text,
  duration_sec numeric,
  selected boolean not null default false,
  error_code text,
  primary key (album_id, version_id)
);
create unique index memory_album_one_selected_version_idx
  on public.memory_album_music_versions (album_id) where selected;

create table public.memory_album_recommendations (
  album_id uuid not null references public.memory_albums(id) on delete cascade,
  position smallint not null check (position between 0 and 19),
  track_id text not null,
  title text not null,
  artist text not null,
  cover_url text,
  reason text not null,
  audio_url text,
  duration_sec numeric,
  playable boolean not null,
  source text not null default 'mock' check (source = 'mock'),
  primary key (album_id, position)
);

create table public.memory_album_runs (
  album_id uuid not null references public.memory_albums(id) on delete cascade,
  kind text not null check (kind in ('ai_generation', 'qq_recommendations', 'save')),
  attempt_id text,
  status text not null check (status in ('pending', 'ready', 'failed')),
  source text check (source in ('api', 'demo', 'mock')),
  error_code text,
  created_at timestamptz not null default now(),
  primary key (album_id, kind)
);

alter table public.memory_albums enable row level security;
alter table public.memory_album_photos enable row level security;
alter table public.memory_album_music_versions enable row level security;
alter table public.memory_album_recommendations enable row level security;
alter table public.memory_album_runs enable row level security;

revoke all on public.memory_albums, public.memory_album_photos,
  public.memory_album_music_versions, public.memory_album_recommendations,
  public.memory_album_runs from public, anon, authenticated;
grant select, insert, update, delete on public.memory_albums,
  public.memory_album_photos, public.memory_album_music_versions,
  public.memory_album_recommendations, public.memory_album_runs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-album-photos', 'memory-album-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

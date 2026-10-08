-- SDD-07: store a bounded upload manifest on the existing private album row.
-- Old ready albums keep NULL manifest and continue to use their existing paths.
alter table public.memory_albums
  add column photo_manifest jsonb,
  add column upload_started_at timestamptz,
  add column verification_started_at timestamptz;

alter table public.memory_albums
  drop constraint memory_albums_status_check;
alter table public.memory_albums
  add constraint memory_albums_status_check
  check (status in ('pending', 'verifying', 'ready', 'failed', 'cleaning'));

alter table public.memory_albums
  add constraint memory_albums_photo_manifest_check
  check (
    photo_manifest is null or
    case when jsonb_typeof(photo_manifest) = 'array'
      then jsonb_array_length(photo_manifest) between 1 and 9
      else false
    end
  );

alter table public.memory_albums
  add constraint memory_albums_upload_started_check
  check (photo_manifest is null or upload_started_at is not null);

create index memory_albums_stale_upload_idx
  on public.memory_albums (upload_started_at, id)
  where photo_manifest is not null
    and status in ('pending', 'verifying', 'failed', 'cleaning');

-- Candidates do not change the active music until the owner confirms them.
alter table public.memory_album_music_versions add column base_version_id text;

create function public.memory_album_confirm_music(
  p_album_id uuid, p_owner_key text, p_version_id text, p_base_version_id text
) returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  current_version text;
  candidate_base text;
begin
  perform 1 from public.memory_albums
    where id = p_album_id and owner_key = p_owner_key and status = 'ready'
    for update;
  if not found then raise exception 'ALBUM_NOT_FOUND'; end if;

  select version_id into current_version from public.memory_album_music_versions
    where album_id = p_album_id and selected;
  -- A lost response can safely be retried after the same version was selected.
  if current_version = p_version_id then return; end if;
  if current_version is distinct from p_base_version_id then
    raise exception 'MUSIC_CONFLICT';
  end if;
  select base_version_id into candidate_base
    from public.memory_album_music_versions
    where album_id = p_album_id and version_id = p_version_id
      and version_id like 'adjust:%' and status = 'ready'
      and kind = 'ai' and source = 'api' and audio_url is not null;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  if candidate_base is distinct from current_version then
    raise exception 'MUSIC_CONFLICT';
  end if;

  update public.memory_album_music_versions set selected = false
    where album_id = p_album_id and selected;
  update public.memory_album_music_versions set selected = true
    where album_id = p_album_id and version_id = p_version_id;
  update public.memory_albums set selected_kind = 'ai', selected_track_id = p_version_id
    where id = p_album_id;
end;
$$;

revoke all on function public.memory_album_confirm_music(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.memory_album_confirm_music(uuid,text,text,text)
  to service_role;

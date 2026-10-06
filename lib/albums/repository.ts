import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ALBUM_BUCKET } from "./contract";

export function albumAdmin() {
  const key = process.env.SECRET_KEY;
  if (!key || key.startsWith("replace-"))
    throw new Error("ALBUM_STORE_UNAVAILABLE");
  const { url } = getSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function albumPhotoPath(albumId: string, position: number): string {
  return `albums/${albumId}/${position}`;
}

export async function listAlbums(ownerKey: string) {
  const db = albumAdmin();
  const { data, error } = await db
    .from("memory_albums")
    .select(
      "id,title,event_date,caption,photo_count,created_at,selected_kind,selected_track_id",
    )
    .eq("owner_key", ownerKey)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error("ALBUM_READ_UNAVAILABLE");
  return (data ?? []).map((album) => ({
    id: album.id,
    title: album.title,
    eventDate: album.event_date,
    caption: album.caption,
    photoCount: album.photo_count,
    createdAt: album.created_at,
    selectedKind: album.selected_kind,
    coverUrl: `/api/albums/${album.id}/photos/0`,
  }));
}

export async function getAlbum(ownerKey: string, albumId: string) {
  const db = albumAdmin();
  const { data: album, error } = await db
    .from("memory_albums")
    .select(
      "id,title,event_date,caption,photo_count,created_at,memory_profile,selected_kind,selected_track_id",
    )
    .eq("id", albumId)
    .eq("owner_key", ownerKey)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw new Error("ALBUM_READ_UNAVAILABLE");
  if (!album) return null;
  const [photos, music, recommendations, runs] = await Promise.all([
    db
      .from("memory_album_photos")
      .select("position,original_name,mime_type,byte_size")
      .eq("album_id", albumId)
      .order("position"),
    db
      .from("memory_album_music_versions")
      .select(
        "version_id,kind,status,source,title,artist,audio_url,audio_mime_type,duration_sec,selected,error_code",
      )
      .eq("album_id", albumId),
    db
      .from("memory_album_recommendations")
      .select(
        "position,track_id,title,artist,cover_url,reason,audio_url,duration_sec,playable,source",
      )
      .eq("album_id", albumId)
      .order("position"),
    db
      .from("memory_album_runs")
      .select("kind,attempt_id,status,source,error_code")
      .eq("album_id", albumId),
  ]);
  if (photos.error || music.error || recommendations.error || runs.error)
    throw new Error("ALBUM_READ_UNAVAILABLE");
  return {
    id: album.id,
    title: album.title,
    eventDate: album.event_date,
    caption: album.caption,
    photoCount: album.photo_count,
    createdAt: album.created_at,
    memory: album.memory_profile,
    selectedKind: album.selected_kind,
    selectedTrackId: album.selected_track_id,
    photos: (photos.data ?? []).map((photo) => ({
      ...photo,
      url: `/api/albums/${albumId}/photos/${photo.position}`,
    })),
    music: music.data ?? [],
    recommendations: recommendations.data ?? [],
    runs: runs.data ?? [],
  };
}

export async function downloadAlbumPhoto(
  ownerKey: string,
  albumId: string,
  index: number,
) {
  const db = albumAdmin();
  const { data: album } = await db
    .from("memory_albums")
    .select("id")
    .eq("id", albumId)
    .eq("owner_key", ownerKey)
    .eq("status", "ready")
    .maybeSingle();
  if (!album) return null;
  const { data: photo } = await db
    .from("memory_album_photos")
    .select("storage_path,mime_type")
    .eq("album_id", albumId)
    .eq("position", index)
    .maybeSingle();
  if (!photo) return null;
  const { data, error } = await db.storage
    .from(ALBUM_BUCKET)
    .download(photo.storage_path);
  if (error || !data) return null;
  return { data, mimeType: photo.mime_type };
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ALBUM_BUCKET } from "./contract";
import type { AlbumPhotoManifestItem, ValidAlbumInput } from "./contract";

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

export function missingStorageObject(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

export async function findTransferAlbum(ownerKey: string, requestId: string) {
  const { data, error } = await albumAdmin()
    .from("memory_albums")
    .select(
      "id,owner_key,request_id,input_digest,status,photo_manifest,upload_started_at,verification_started_at",
    )
    .eq("owner_key", ownerKey)
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new Error("ALBUM_STORE_UNAVAILABLE");
  return data;
}

export async function createTransferAlbum(
  ownerKey: string,
  input: ValidAlbumInput,
  photos: AlbumPhotoManifestItem[],
  digest: string,
) {
  const albumId = crypto.randomUUID();
  const { error } = await albumAdmin()
    .from("memory_albums")
    .insert({
      id: albumId,
      owner_key: ownerKey,
      request_id: input.requestId,
      input_digest: digest,
      status: "pending",
      title: input.title,
      event_date: input.eventDate,
      caption: input.caption,
      memory_profile: input.memory,
      selected_kind: input.selectedKind,
      selected_track_id:
        input.selectedKind === "qq" && input.music.selection.kind === "qq"
          ? input.music.selection.trackId
          : (input.music.adjustedTrack?.versionId ??
            input.music.ai.attemptId ??
            "ai"),
      photo_count: photos.length,
      photo_manifest: photos,
      upload_started_at: new Date().toISOString(),
    });
  if (!error) return albumId;
  const existing = await findTransferAlbum(ownerKey, input.requestId);
  if (existing) return existing.id as string;
  throw new Error("ALBUM_STORE_UNAVAILABLE");
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

export async function signedAlbumPhoto(
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
    .select("storage_path")
    .eq("album_id", albumId)
    .eq("position", index)
    .maybeSingle();
  if (!photo || photo.storage_path !== albumPhotoPath(albumId, index))
    return null;
  const { data, error } = await db.storage
    .from(ALBUM_BUCKET)
    .createSignedUrl(photo.storage_path, 60);
  if (error || !data) throw new Error("ALBUM_READ_UNAVAILABLE");
  return data.signedUrl;
}

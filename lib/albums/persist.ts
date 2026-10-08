import "server-only";

import type { AlbumPhotoManifestItem, ValidAlbumInput } from "./contract";
import { albumPhotoPath, type albumAdmin } from "./repository";

type AlbumDb = ReturnType<typeof albumAdmin>;

function unavailable(): never {
  throw new Error("ALBUM_STORE_UNAVAILABLE");
}

export async function persistAlbumDetails(
  db: AlbumDb,
  albumId: string,
  ownerKey: string,
  input: ValidAlbumInput,
  photos: Pick<
    AlbumPhotoManifestItem,
    "position" | "originalName" | "mimeType" | "byteSize"
  >[],
  expectedStatus: "pending" | "verifying",
) {
  for (const table of [
    "memory_album_photos",
    "memory_album_music_versions",
    "memory_album_recommendations",
    "memory_album_runs",
  ] as const) {
    const removed = await db.from(table).delete().eq("album_id", albumId);
    if (removed.error) unavailable();
  }
  const photoRows = photos.map((photo) => ({
    album_id: albumId,
    position: photo.position,
    storage_path: albumPhotoPath(albumId, photo.position),
    original_name: photo.originalName.slice(0, 255),
    mime_type: photo.mimeType,
    byte_size: photo.byteSize,
  }));
  if ((await db.from("memory_album_photos").insert(photoRows)).error)
    unavailable();
  const music = input.music;
  const aiTrack = music.adjustedTrack ?? music.ai.track;
  const versions: Record<string, unknown>[] = [
    {
      album_id: albumId,
      version_id: `ai:${music.adjustedTrack?.versionId ?? music.ai.attemptId ?? "none"}`,
      kind: "ai",
      status: aiTrack
        ? "ready"
        : music.ai.status === "failed"
          ? "failed"
          : "pending",
      source: aiTrack?.source ?? music.ai.source,
      title: aiTrack?.title ?? null,
      artist: "AI 原创配乐",
      audio_url: aiTrack?.audioUrl ?? null,
      audio_mime_type: aiTrack?.audioMimeType ?? null,
      duration_sec: aiTrack?.durationSec ?? null,
      selected: input.selectedKind === "ai",
      error_code: music.ai.error?.code ?? null,
    },
  ];
  if (input.selectedKind === "qq" && music.selection.kind === "qq") {
    const selectedQqId = music.selection.trackId;
    const qq = music.recommendations.tracks.find(
      (item) => item.id === selectedQqId,
    );
    if (qq)
      versions.push({
        album_id: albumId,
        version_id: `qq:${qq.id}`,
        kind: "qq",
        status: "ready",
        source: "mock",
        title: qq.title,
        artist: qq.artist,
        audio_url: qq.audioUrl,
        audio_mime_type: "audio/wav",
        duration_sec: qq.durationSec,
        selected: true,
        error_code: null,
      });
  }
  if ((await db.from("memory_album_music_versions").insert(versions)).error)
    unavailable();
  const recommendations = music.recommendations.tracks
    .slice(0, 20)
    .map((track, position) => ({
      album_id: albumId,
      position,
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      cover_url: track.coverUrl,
      reason: track.reason,
      audio_url: track.audioUrl,
      duration_sec: track.durationSec,
      playable: track.playable,
      source: "mock",
    }));
  if (
    recommendations.length &&
    (await db.from("memory_album_recommendations").insert(recommendations))
      .error
  )
    unavailable();
  const runs = [
    {
      album_id: albumId,
      kind: "ai_generation",
      attempt_id: music.ai.attemptId,
      status:
        music.ai.status === "ready"
          ? "ready"
          : music.ai.status === "failed"
            ? "failed"
            : "pending",
      source: music.ai.source,
      error_code: music.ai.error?.code ?? null,
    },
    {
      album_id: albumId,
      kind: "qq_recommendations",
      attempt_id: music.recommendations.attemptId,
      status:
        music.recommendations.status === "ready"
          ? "ready"
          : music.recommendations.status === "failed"
            ? "failed"
            : "pending",
      source: "mock",
      error_code: music.recommendations.error?.code ?? null,
    },
    {
      album_id: albumId,
      kind: "save",
      attempt_id: input.requestId,
      status: "ready",
      source: null,
      error_code: null,
    },
  ];
  if ((await db.from("memory_album_runs").insert(runs)).error) unavailable();
  const published = await db
    .from("memory_albums")
    .update({
      status: "ready",
      error_code: null,
      saved_at: new Date().toISOString(),
    })
    .eq("id", albumId)
    .eq("owner_key", ownerKey)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();
  if (published.error || !published.data) unavailable();
}

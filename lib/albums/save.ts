import "server-only";

import { createHash } from "node:crypto";
import type { AlbumIdentity } from "./identity";
import {
  ALBUM_BUCKET,
  MAX_ALBUM_BYTES,
  validPhotoFile,
  validateAlbumInput,
  validateAlbumTransferInput,
} from "./contract";
import { transferDigest } from "./digest";
import { persistAlbumDetails } from "./persist";
import { albumAdmin, albumPhotoPath, missingStorageObject } from "./repository";

export class AlbumSaveError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function databaseError(): never {
  throw new AlbumSaveError("SAVE_UNAVAILABLE", 503, "保存暂时失败，请重试。");
}

export async function saveAlbum(identity: AlbumIdentity, form: FormData) {
  const raw = form.get("snapshot");
  const photos = form.getAll("photos");
  if (
    typeof raw !== "string" ||
    raw.length > 100_000 ||
    photos.some((item) => !(item instanceof File))
  )
    throw new AlbumSaveError(
      "INVALID_INPUT",
      400,
      "保存内容无效，请返回播放页。 ",
    );
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    throw new AlbumSaveError(
      "INVALID_INPUT",
      400,
      "保存内容无效，请返回播放页。",
    );
  }
  const files = photos as File[];
  if (
    files.some((file) => !validPhotoFile(file)) ||
    files.reduce((size, file) => size + file.size, 0) > MAX_ALBUM_BYTES
  )
    throw new AlbumSaveError(
      "INVALID_PHOTOS",
      413,
      "照片需为 1–9 张 JPEG、PNG 或 WebP，单张不超过 10 MiB。 ",
    );
  const checked = validateAlbumInput(snapshot, files.length);
  if (!checked.ok)
    throw new AlbumSaveError("INVALID_INPUT", 400, checked.message);
  const input = checked.value;
  const digest = createHash("sha256").update(
    JSON.stringify({
      title: input.title,
      eventDate: input.eventDate,
      caption: input.caption,
      memory: input.memory,
      music: input.music,
    }),
  );
  const bytes: ArrayBuffer[] = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const header = new Uint8Array(buffer);
    const validHeader =
      file.type === "image/jpeg"
        ? header[0] === 0xff && header[1] === 0xd8
        : file.type === "image/png"
          ? header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
          : header[0] === 0x52 &&
            header[1] === 0x49 &&
            header[2] === 0x46 &&
            header[3] === 0x46;
    if (!validHeader)
      throw new AlbumSaveError(
        "INVALID_PHOTOS",
        422,
        "有照片无法读取，请更换后重试。 ",
      );
    digest.update(Buffer.from(buffer));
    bytes.push(buffer);
  }
  const inputDigest = digest.digest("hex");
  const db = albumAdmin();
  const lookup = () =>
    db
      .from("memory_albums")
      .select("id,status,input_digest")
      .eq("owner_key", identity.ownerKey)
      .eq("request_id", input.requestId)
      .maybeSingle();
  let existing = await lookup();
  if (existing.error) databaseError();
  const albumId = existing.data?.id ?? crypto.randomUUID();
  if (existing.data) {
    if (existing.data.input_digest !== inputDigest)
      throw new AlbumSaveError(
        "REQUEST_CONFLICT",
        409,
        "本次保存内容已变化，请重新提交。 ",
      );
    if (existing.data.status === "ready")
      return { albumId, alreadySaved: true };
    if (existing.data.status === "pending")
      throw new AlbumSaveError(
        "SAVE_IN_PROGRESS",
        409,
        "相册仍在保存，请稍后查看列表。 ",
      );
    const claim = await db
      .from("memory_albums")
      .update({ status: "pending", error_code: null })
      .eq("id", albumId)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data)
      throw new AlbumSaveError("SAVE_IN_PROGRESS", 409, "相册正在重试保存。 ");
  } else {
    const inserted = await db.from("memory_albums").insert({
      id: albumId,
      owner_key: identity.ownerKey,
      request_id: input.requestId,
      input_digest: inputDigest,
      status: "pending",
      title: input.title,
      event_date: input.eventDate,
      caption: input.caption,
      memory_profile: input.memory,
      selected_kind: input.selectedKind,
      selected_track_id:
        input.selectedKind === "qq"
          ? input.music.selection.kind === "qq"
            ? input.music.selection.trackId
            : ""
          : (input.music.adjustedTrack?.versionId ??
            input.music.ai.attemptId ??
            "ai"),
      photo_count: files.length,
    });
    if (inserted.error) {
      existing = await lookup();
      if (
        existing.data?.input_digest === inputDigest &&
        existing.data.status === "ready"
      )
        return { albumId: existing.data.id, alreadySaved: true };
      if (existing.data)
        throw new AlbumSaveError(
          "SAVE_IN_PROGRESS",
          409,
          "相册正在保存，请稍后查看列表。 ",
        );
      databaseError();
    }
  }
  const uploaded: string[] = [];
  try {
    for (const [position, file] of files.entries()) {
      const path = albumPhotoPath(albumId, position);
      const result = await db.storage
        .from(ALBUM_BUCKET)
        .upload(path, bytes[position], {
          contentType: file.type,
          upsert: true,
          cacheControl: "0",
        });
      if (result.error) databaseError();
      uploaded.push(path);
    }
    for (const table of [
      "memory_album_photos",
      "memory_album_music_versions",
      "memory_album_recommendations",
      "memory_album_runs",
    ] as const) {
      const removed = await db.from(table).delete().eq("album_id", albumId);
      if (removed.error) databaseError();
    }
    const photoRows = files.map((file, position) => ({
      album_id: albumId,
      position,
      storage_path: albumPhotoPath(albumId, position),
      original_name: file.name.slice(0, 255),
      mime_type: file.type,
      byte_size: file.size,
    }));
    if ((await db.from("memory_album_photos").insert(photoRows)).error)
      databaseError();
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
      databaseError();
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
      databaseError();
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
    if ((await db.from("memory_album_runs").insert(runs)).error)
      databaseError();
    const published = await db
      .from("memory_albums")
      .update({
        status: "ready",
        error_code: null,
        saved_at: new Date().toISOString(),
      })
      .eq("id", albumId)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (published.error || !published.data) databaseError();
    return { albumId, alreadySaved: false };
  } catch {
    if (uploaded.length) await db.storage.from(ALBUM_BUCKET).remove(uploaded);
    await db
      .from("memory_albums")
      .update({ status: "failed", error_code: "SAVE_UNAVAILABLE" })
      .eq("id", albumId)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "pending");
    databaseError();
  }
}

function matchesPhotoHeader(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (mimeType === "image/png")
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (byte, index) => bytes[index] === byte,
      )
    );
  return (
    mimeType === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  );
}

export async function completeAlbumTransfer(
  identity: AlbumIdentity,
  raw: unknown,
) {
  const checked = validateAlbumTransferInput(raw, true);
  if (!checked.ok)
    throw new AlbumSaveError("INVALID_INPUT", checked.status, checked.message);
  const { snapshot, photos, albumId } = checked.value;
  if (!albumId)
    throw new AlbumSaveError("INVALID_INPUT", 400, "相册标识无效。 ");
  const db = albumAdmin();
  const { data: album, error } = await db
    .from("memory_albums")
    .select("id,status,input_digest,photo_manifest,upload_started_at")
    .eq("id", albumId)
    .eq("owner_key", identity.ownerKey)
    .eq("request_id", snapshot.requestId)
    .maybeSingle();
  if (error) databaseError();
  if (!album)
    throw new AlbumSaveError("ALBUM_NOT_FOUND", 404, "找不到本次保存记录。 ");
  if (
    album.input_digest !== transferDigest(snapshot, photos) ||
    !album.photo_manifest
  )
    throw new AlbumSaveError(
      "REQUEST_CONFLICT",
      409,
      "本次保存内容已变化，请重新提交。 ",
    );
  if (album.status === "ready") return { albumId, alreadySaved: true };
  if (album.status !== "pending")
    throw new AlbumSaveError(
      "SAVE_IN_PROGRESS",
      409,
      "相册正在保存或已过期，请稍后重试。 ",
    );
  if (
    !album.upload_started_at ||
    Date.now() - new Date(album.upload_started_at).getTime() >= 24 * 60 * 60_000
  )
    throw new AlbumSaveError(
      "UPLOAD_EXPIRED",
      409,
      "上传已过期，请重新发起保存。 ",
    );
  const claim = await db
    .from("memory_albums")
    .update({
      status: "verifying",
      verification_started_at: new Date().toISOString(),
    })
    .eq("id", albumId)
    .eq("owner_key", identity.ownerKey)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claim.error) databaseError();
  if (!claim.data)
    throw new AlbumSaveError(
      "SAVE_IN_PROGRESS",
      409,
      "相册正在保存，请稍后重试。 ",
    );
  try {
    for (const photo of photos) {
      const path = albumPhotoPath(albumId, photo.position);
      const downloaded = await db.storage.from(ALBUM_BUCKET).download(path);
      if (downloaded.error && !missingStorageObject(downloaded.error))
        throw new AlbumSaveError(
          "SAVE_UNAVAILABLE",
          503,
          "暂时无法核对照片，请重试。",
        );
      if (downloaded.error || !downloaded.data)
        throw new AlbumSaveError(
          "PHOTO_MISSING",
          409,
          `第 ${photo.position + 1} 张照片尚未上传，请重试。`,
        );
      const blob = downloaded.data;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const actualDigest = createHash("sha256").update(bytes).digest("hex");
      if (
        bytes.length !== photo.byteSize ||
        blob.type.split(";")[0] !== photo.mimeType ||
        !matchesPhotoHeader(bytes, photo.mimeType) ||
        actualDigest !== photo.sha256
      ) {
        const removed = await db.storage.from(ALBUM_BUCKET).remove([path]);
        if (removed.error) databaseError();
        throw new AlbumSaveError(
          "PHOTO_MISMATCH",
          422,
          `第 ${photo.position + 1} 张照片不匹配，请重新上传。`,
        );
      }
    }
    await persistAlbumDetails(
      db,
      albumId,
      identity.ownerKey,
      snapshot,
      photos,
      "verifying",
    );
    return { albumId, alreadySaved: false };
  } catch (cause) {
    const retryable = cause instanceof AlbumSaveError && cause.status < 500;
    await db
      .from("memory_albums")
      .update({
        status: retryable ? "pending" : "failed",
        error_code:
          cause instanceof AlbumSaveError ? cause.code : "SAVE_UNAVAILABLE",
        verification_started_at: null,
      })
      .eq("id", albumId)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "verifying");
    if (cause instanceof AlbumSaveError) throw cause;
    databaseError();
  }
}

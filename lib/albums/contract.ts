import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";
import {
  type AiTrack,
  type MockRecommendation,
  type MusicRun,
  validateMusicProfile,
} from "@/lib/music/contract";

export const ALBUM_BUCKET = "memory-album-photos";
export const MAX_ALBUM_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const albumIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SaveAlbumInput = {
  contractVersion: 1;
  requestId: string;
  title: string;
  eventDate: string | null;
  caption: string;
  memory: MemoryProfile;
  music: MusicRun;
};

export type ValidAlbumInput = SaveAlbumInput & {
  selected: AiTrack | MockRecommendation;
  selectedKind: "ai" | "qq";
};

export type AlbumPhotoManifestItem = {
  position: number;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  sha256: string;
};

export type AlbumTransferInput = {
  snapshot: ValidAlbumInput;
  photos: AlbumPhotoManifestItem[];
  albumId?: string;
};

export function validateAlbumTransferInput(
  raw: unknown,
  requireAlbumId: boolean,
):
  | { ok: true; value: AlbumTransferInput }
  | { ok: false; message: string; status: number } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, message: "保存内容无效。", status: 400 };
  const data = raw as Record<string, unknown>;
  const allowed = requireAlbumId
    ? ["snapshot", "photos", "albumId"]
    : ["snapshot", "photos"];
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    return { ok: false, message: "保存内容包含无效字段。", status: 400 };
  if (
    !Array.isArray(data.photos) ||
    data.photos.length < 1 ||
    data.photos.length > 9
  )
    return { ok: false, message: "请选择 1–9 张照片。", status: 400 };
  const photos: AlbumPhotoManifestItem[] = [];
  let totalBytes = 0;
  for (const [position, rawPhoto] of data.photos.entries()) {
    if (!rawPhoto || typeof rawPhoto !== "object" || Array.isArray(rawPhoto))
      return { ok: false, message: "照片清单无效。", status: 400 };
    const photo = rawPhoto as Record<string, unknown>;
    if (
      Object.keys(photo).some(
        (key) =>
          ![
            "position",
            "originalName",
            "mimeType",
            "byteSize",
            "sha256",
          ].includes(key),
      ) ||
      photo.position !== position ||
      typeof photo.originalName !== "string" ||
      !photo.originalName.trim() ||
      photo.originalName.length > 255 ||
      [...photo.originalName].some(
        (character) =>
          character === "/" ||
          character === "\\" ||
          character.charCodeAt(0) < 32,
      ) ||
      !["image/jpeg", "image/png", "image/webp"].includes(
        String(photo.mimeType),
      ) ||
      !Number.isInteger(photo.byteSize) ||
      Number(photo.byteSize) < 1 ||
      Number(photo.byteSize) > MAX_PHOTO_BYTES ||
      typeof photo.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(photo.sha256)
    )
      return { ok: false, message: "照片清单无效。", status: 400 };
    totalBytes += Number(photo.byteSize);
    photos.push({
      position,
      originalName: photo.originalName,
      mimeType: photo.mimeType as AlbumPhotoManifestItem["mimeType"],
      byteSize: Number(photo.byteSize),
      sha256: photo.sha256,
    });
  }
  if (totalBytes > MAX_ALBUM_BYTES)
    return { ok: false, message: "照片总大小不能超过 50 MiB。", status: 413 };
  if (
    requireAlbumId &&
    (typeof data.albumId !== "string" || !albumIdPattern.test(data.albumId))
  )
    return { ok: false, message: "相册标识无效。", status: 400 };
  let checked: ReturnType<typeof validateAlbumInput>;
  try {
    checked = validateAlbumInput(data.snapshot, photos.length);
  } catch {
    return { ok: false, message: "保存内容无效。", status: 400 };
  }
  if (!checked.ok) return { ok: false, message: checked.message, status: 400 };
  return {
    ok: true,
    value: {
      snapshot: checked.value,
      photos,
      albumId: requireAlbumId ? (data.albumId as string) : undefined,
    },
  };
}

function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function trustedAudio(url: string, kind: "ai" | "qq"): boolean {
  if (kind === "qq") return url === "/audio/music-album/mock-qq.wav";
  if (url === "/audio/music-album/demo-ai.wav") return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "fal.media" ||
        parsed.hostname.endsWith(".fal.media"))
    );
  } catch {
    return false;
  }
}

export function validateAlbumInput(
  raw: unknown,
  photoCount: number,
): { ok: true; value: ValidAlbumInput } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object")
    return { ok: false, message: "保存内容无效。" };
  const data = raw as Partial<SaveAlbumInput>;
  if (
    data.contractVersion !== 1 ||
    !data.requestId ||
    !albumIdPattern.test(data.requestId)
  )
    return { ok: false, message: "保存请求无效，请重试。" };
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.trim().length > 80
  )
    return { ok: false, message: "标题需为 1–80 字。" };
  if (typeof data.caption !== "string" || data.caption.trim().length > 300)
    return { ok: false, message: "一句话记忆不能超过 300 字。" };
  if (
    data.eventDate !== null &&
    (typeof data.eventDate !== "string" || !validCalendarDay(data.eventDate))
  )
    return { ok: false, message: "事件日期格式无效，请修正。" };
  if (photoCount < 1 || photoCount > 9)
    return { ok: false, message: "请选择 1–9 张照片。" };
  const memory = normalizeProfile(data.memory, photoCount);
  if (!memory || !data.music || !validateMusicProfile(data.music.profile))
    return { ok: false, message: "本次记忆已失效，请返回创建页。" };
  const run = data.music;
  if (
    run.profile.memoryVersion !== memory.version ||
    run.profile.memoryTitle !== memory.title
  )
    return { ok: false, message: "音乐与本次记忆不匹配。" };
  const kind = run.selection.kind;
  const selected =
    kind === "qq"
      ? run.recommendations.tracks.find(
          (track) =>
            track.id ===
              (run.selection.kind === "qq" ? run.selection.trackId : "") &&
            track.playable &&
            track.audioUrl,
        )
      : (run.adjustedTrack ??
        (run.ai.status === "ready" ? run.ai.track : null));
  if (!selected?.audioUrl || !trustedAudio(selected.audioUrl, kind))
    return { ok: false, message: "请先选择一段可播放的成品音乐。" };
  if (kind === "ai" && !["api", "demo"].includes(selected.source))
    return { ok: false, message: "配乐来源无效。" };
  if (kind === "qq" && selected.source !== "mock")
    return { ok: false, message: "推荐来源无效。" };
  return {
    ok: true,
    value: {
      contractVersion: 1,
      requestId: data.requestId,
      title: data.title.trim(),
      eventDate: data.eventDate,
      caption: data.caption.trim(),
      memory,
      music: run,
      selected,
      selectedKind: kind,
    },
  };
}

export function validPhotoFile(file: File): boolean {
  return (
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_PHOTO_BYTES
  );
}

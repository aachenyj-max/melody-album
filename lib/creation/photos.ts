import "server-only";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CREATION_BUCKET,
  CreationError,
  uuid,
  type CreationPhoto,
} from "./contract";
import {
  readDraft,
  writeDraft,
  expectRevision,
  staleCards,
  appendMessage,
  startTurn,
  type DraftRow,
} from "./repository";

export async function loadPhoto(photo: CreationPhoto) {
  const { data, error } = await createAdminClient()
    .storage.from(CREATION_BUCKET)
    .download(photo.path);
  if (error || !data)
    throw new CreationError(
      "PHOTO_UNAVAILABLE",
      "照片暂时无法读取，请重试或更换。",
      503,
    );
  return new Uint8Array(await data.arrayBuffer());
}
export async function analysisPhotos(row: DraftRow) {
  return Promise.all(
    row.state.photoIds.map(async (id) => {
      const p = row.state.photos.find((p) => p.id === id);
      if (!p) throw new CreationError("INVALID_STATE", "照片记录不完整。", 503);
      const bytes = await loadPhoto(p);
      return new Uint8Array(
        await sharp(bytes, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer(),
      );
    }),
  );
}
export async function preparePhotos(
  row: DraftRow,
  raw: Record<string, unknown>,
) {
  const requestId = uuid(raw.requestId);
  const previous = row.state.photos.filter((p) => p.requestId === requestId);
  if (
    previous.length &&
    (!Array.isArray(raw.files) ||
      raw.files.length !== previous.length ||
      raw.files.some(
        (file: Record<string, unknown>, i: number) =>
          file.clientPhotoId !== previous[i].id ||
          file.mime !== previous[i].mime ||
          file.bytes !== previous[i].bytes ||
          String(file.name).slice(0, 100) !== previous[i].name,
      ))
  )
    throw new CreationError(
      "CONFLICT",
      "本次上传内容已变化，请重新选择照片。",
      409,
    );
  let prepared = previous;
  if (!previous.length) {
    expectRevision(row, raw.expectedRevision);
    if (
      !Array.isArray(raw.files) ||
      !raw.files.length ||
      raw.files.length + row.state.photoIds.length > 9
    )
      throw new CreationError("INVALID_PHOTO_COUNT", "最多选择 9 张照片。");
    prepared = raw.files.map((file: Record<string, unknown>) => {
      const mime = String(file.mime);
      const bytes = Number(file.bytes);
      const id = uuid(file.clientPhotoId);
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(mime) ||
        !Number.isSafeInteger(bytes) ||
        bytes < 1 ||
        bytes > 10 * 1024 * 1024
      )
        throw new CreationError(
          "INVALID_PHOTO",
          "仅支持有效 JPEG、PNG、WebP，单张不超过 10 MiB。",
        );
      return {
        id,
        path: `drafts/${row.id}/${id}`,
        requestId,
        mime,
        bytes,
        name: String(file.name).slice(0, 100),
        status: "uploading" as const,
      };
    });
    if (
      new Set(prepared.map((p) => p.id)).size !== prepared.length ||
      prepared.some((p) => row.state.photos.some((old) => old.id === p.id))
    )
      throw new CreationError("INVALID_PHOTO", "照片标识重复。");
    const current = row.state.photos.filter((p) =>
      row.state.photoIds.includes(p.id),
    );
    if (
      [...current, ...prepared].reduce((n, p) => n + p.bytes, 0) >
      50 * 1024 * 1024
    )
      throw new CreationError(
        "PHOTO_TOO_LARGE",
        "照片总大小不能超过 50 MiB。",
        413,
      );
    row.state.photos.push(...prepared);
    row = await writeDraft(row, row.state);
  }
  const photos = await Promise.all(
    prepared.map(async (p) => {
      const signed = await createAdminClient()
        .storage.from(CREATION_BUCKET)
        .createSignedUploadUrl(p.path);
      if (signed.error || !signed.data)
        throw new CreationError(
          "UPLOAD_UNAVAILABLE",
          "暂时无法上传照片，请重试。",
          503,
        );
      return { id: p.id, path: p.path, token: signed.data.token };
    }),
  );
  return { row, photos };
}
export async function commitPhotos(
  row: DraftRow,
  raw: Record<string, unknown>,
) {
  const requestId = uuid(raw.requestId);
  if (!Array.isArray(raw.photoIds))
    throw new CreationError("INVALID_INPUT", "照片集合无效。");
  const ids = raw.photoIds.map(uuid);
  const previous = row.state.photoRequests.find(
    (r) => r.requestId === requestId,
  );
  if (previous) {
    if (JSON.stringify(previous.photoIds) !== JSON.stringify(ids))
      throw new CreationError("CONFLICT", "本次照片内容已变化。", 409);
    return { row, turnId: previous.turnId };
  }
  expectRevision(row, raw.expectedRevision);
  if (ids.length > 9 || new Set(ids).size !== ids.length)
    throw new CreationError("INVALID_PHOTO_COUNT", "最多选择 9 张不同照片。");
  const selected = ids.map((id) => {
    const p = row.state.photos.find(
      (p) => p.id === id && ["active", "uploading"].includes(p.status),
    );
    if (!p)
      throw new CreationError("INVALID_PHOTO", "照片不属于当前有效集合。");
    return p;
  });
  if (selected.reduce((n, p) => n + p.bytes, 0) > 50 * 1024 * 1024)
    throw new CreationError(
      "PHOTO_TOO_LARGE",
      "照片总大小不能超过 50 MiB。",
      413,
    );
  for (const p of selected.filter((p) => p.status === "uploading")) {
    const bytes = await loadPhoto(p);
    if (bytes.length !== p.bytes)
      throw new CreationError(
        "INVALID_PHOTO",
        "照片上传不完整，请重新上传。",
        422,
      );
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      const mime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[
        metadata.format as "jpeg" | "png" | "webp"
      ];
      if (mime !== p.mime || !metadata.width || !metadata.height)
        throw new Error("format");
      await image.resize(16, 16).toBuffer();
    } catch {
      throw new CreationError(
        "INVALID_PHOTO",
        "照片无法读取或格式不匹配，请重新选择。",
        422,
      );
    }
  }
  if (JSON.stringify(ids) === JSON.stringify(row.state.photoIds))
    return { row, turnId: null };
  const added = ids.filter((id) => !row.state.photoIds.includes(id)).length;
  const removed = row.state.photoIds.filter((id) => !ids.includes(id)).length;
  for (const p of row.state.photos) {
    if (ids.includes(p.id)) p.status = "active";
    else if (p.status === "active") p.status = "removed";
  }
  for (const t of row.state.turns)
    if (!["succeeded", "superseded"].includes(t.status)) {
      t.status = "superseded";
      delete t.token;
    }
  row.state.photoIds = ids;
  row.state.photoRevision++;
  row.state.messageRevision++;
  staleCards(row.state);
  const message = appendMessage(row.state, {
    role: "user",
    kind: "photo_change",
    text: `照片已更新：新增 ${added} 张，移除 ${removed} 张，当前 ${ids.length} 张。请依据当前照片和此前的故事重新理解。`,
  });
  const turn = startTurn(row.state, message);
  row.state.photoRequests.push({ requestId, photoIds: ids, turnId: turn.id });
  row = await writeDraft(row, row.state);
  await reclaimRemoved(row);
  return { row: await readDraft(row.owner_key, row.id), turnId: turn.id };
}
export async function reclaimRemoved(row: DraftRow) {
  const referenced = new Set(row.state.snapshots.flatMap((s) => s.photoIds));
  const candidates = row.state.photos.filter(
    (p) =>
      ["removed", "cleanup_pending"].includes(p.status) &&
      !referenced.has(p.id),
  );
  if (!candidates.length) return;
  // Keep the metadata tombstone. Storage deletion is idempotent and retried by maintenance.
  await createAdminClient()
    .storage.from(CREATION_BUCKET)
    .remove(candidates.map((p) => p.path));
}

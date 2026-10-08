import "server-only";

import type { AlbumIdentity } from "./identity";
import { ALBUM_BUCKET, validateAlbumTransferInput } from "./contract";
import { transferDigest } from "./digest";
import {
  albumAdmin,
  albumPhotoPath,
  createTransferAlbum,
  findTransferAlbum,
  missingStorageObject,
} from "./repository";
import { AlbumSaveError } from "./save";

export async function startAlbumUpload(identity: AlbumIdentity, raw: unknown) {
  const checked = validateAlbumTransferInput(raw, false);
  if (!checked.ok)
    throw new AlbumSaveError("INVALID_INPUT", checked.status, checked.message);
  const { snapshot, photos } = checked.value;
  const digest = transferDigest(snapshot, photos);
  const db = albumAdmin();
  let album = await findTransferAlbum(identity.ownerKey, snapshot.requestId);
  if (!album) {
    await createTransferAlbum(identity.ownerKey, snapshot, photos, digest);
    album = await findTransferAlbum(identity.ownerKey, snapshot.requestId);
  }
  if (!album) throw new Error("ALBUM_STORE_UNAVAILABLE");
  if (album.input_digest !== digest || album.photo_manifest === null)
    throw new AlbumSaveError(
      "REQUEST_CONFLICT",
      409,
      "本次保存内容已变化，请重新提交。",
    );
  if (album.status === "ready")
    return {
      albumId: album.id,
      requestId: snapshot.requestId,
      alreadySaved: true,
      photos: [],
    };
  if (album.status === "cleaning")
    throw new AlbumSaveError(
      "UPLOAD_EXPIRED",
      409,
      "上传已过期，请重新发起保存。 ",
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
  if (album.status === "verifying") {
    const age =
      Date.now() - new Date(album.verification_started_at ?? 0).getTime();
    if (age < 10 * 60_000)
      throw new AlbumSaveError(
        "SAVE_IN_PROGRESS",
        409,
        "相册正在保存，请稍后重试。 ",
      );
    const reclaimed = await db
      .from("memory_albums")
      .update({ status: "pending", verification_started_at: null })
      .eq("id", album.id)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "verifying")
      .eq("verification_started_at", album.verification_started_at)
      .select("id")
      .maybeSingle();
    if (reclaimed.error || !reclaimed.data)
      throw new AlbumSaveError(
        "SAVE_IN_PROGRESS",
        409,
        "相册正在保存，请稍后重试。 ",
      );
  }
  if (album.status === "failed") {
    const reopened = await db
      .from("memory_albums")
      .update({
        status: "pending",
        error_code: null,
        upload_started_at: new Date().toISOString(),
      })
      .eq("id", album.id)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (reopened.error || !reopened.data)
      throw new AlbumSaveError(
        "SAVE_IN_PROGRESS",
        409,
        "相册正在重试，请稍后再试。 ",
      );
  }
  const items = [];
  for (const photo of photos) {
    const path = albumPhotoPath(album.id, photo.position);
    const present = await db.storage.from(ALBUM_BUCKET).info(path);
    if (!present.error && present.data) {
      items.push({ position: photo.position, path, uploaded: true });
      continue;
    }
    if (present.error && !missingStorageObject(present.error))
      throw new AlbumSaveError(
        "UPLOAD_UNAVAILABLE",
        503,
        "暂时无法检查照片上传状态，请重试。",
      );
    const signed = await db.storage
      .from(ALBUM_BUCKET)
      .createSignedUploadUrl(path);
    if (signed.error || !signed.data)
      throw new AlbumSaveError(
        "UPLOAD_UNAVAILABLE",
        503,
        "暂时无法上传照片，请重试。 ",
      );
    items.push({
      position: photo.position,
      path,
      uploaded: false,
      token: signed.data.token,
    });
  }
  return {
    albumId: album.id,
    requestId: snapshot.requestId,
    alreadySaved: false,
    photos: items,
  };
}

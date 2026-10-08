import "server-only";

import { ALBUM_BUCKET } from "./contract";
import { albumAdmin, albumPhotoPath } from "./repository";

export async function cleanupExpiredAlbumUploads() {
  const db = albumAdmin();
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: candidates, error } = await db
    .from("memory_albums")
    .select("id,owner_key,status,photo_count")
    .not("photo_manifest", "is", null)
    .lt("upload_started_at", cutoff)
    .in("status", ["pending", "verifying", "failed", "cleaning"])
    .order("upload_started_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("ALBUM_CLEANUP_UNAVAILABLE");
  let removed = 0;
  let failed = 0;
  for (const candidate of candidates ?? []) {
    if (
      !/^[0-9a-f-]{36}$/i.test(candidate.id) ||
      !Number.isInteger(candidate.photo_count) ||
      candidate.photo_count < 1 ||
      candidate.photo_count > 9
    ) {
      failed++;
      continue;
    }
    const claim = await db
      .from("memory_albums")
      .update({ status: "cleaning" })
      .eq("id", candidate.id)
      .eq("owner_key", candidate.owner_key)
      .eq("status", candidate.status)
      .lt("upload_started_at", cutoff)
      .not("photo_manifest", "is", null)
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) {
      failed++;
      continue;
    }
    const paths = Array.from({ length: candidate.photo_count }, (_, position) =>
      albumPhotoPath(candidate.id, position),
    );
    const storage = await db.storage.from(ALBUM_BUCKET).remove(paths);
    if (storage.error) {
      failed++;
      continue;
    }
    const deleted = await db
      .from("memory_albums")
      .delete()
      .eq("id", candidate.id)
      .eq("owner_key", candidate.owner_key)
      .eq("status", "cleaning")
      .select("id")
      .maybeSingle();
    if (deleted.error || !deleted.data) {
      failed++;
      continue;
    }
    removed++;
  }
  return { scanned: candidates?.length ?? 0, removed, failed };
}

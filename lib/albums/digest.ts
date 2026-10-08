import "server-only";

import { createHash } from "node:crypto";
import type { AlbumPhotoManifestItem, ValidAlbumInput } from "./contract";

export function transferDigest(
  snapshot: ValidAlbumInput,
  photos: AlbumPhotoManifestItem[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ snapshot, photos }))
    .digest("hex");
}

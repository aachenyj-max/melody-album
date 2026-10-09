import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREATION_BUCKET } from "./contract";
import { reclaimRemoved } from "./photos";
import type { DraftRow } from "./repository";

export async function cleanupCreationDrafts() {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("creation_drafts")
    .select("*")
    .lt("expires_at", now)
    .order("expires_at")
    .limit(100);
  if (error) throw new Error("CREATION_CLEANUP_UNAVAILABLE");
  let removed = 0;
  let failed = 0;
  for (const row of (data ?? []) as DraftRow[]) {
    const paths = row.state.photos.map((p) => p.path);
    if (paths.length) {
      const storage = await db.storage.from(CREATION_BUCKET).remove(paths);
      if (storage.error) {
        failed++;
        continue;
      }
    }
    const deletion = await db
      .from("creation_drafts")
      .delete()
      .eq("id", row.id)
      .eq("revision", row.revision)
      .lt("expires_at", now)
      .select("id");
    if (deletion.error || !deletion.data?.length) failed++;
    else removed++;
  }
  const active = await db
    .from("creation_drafts")
    .select("*")
    .gt("expires_at", now)
    .order("updated_at")
    .limit(100);
  if (active.error) failed++;
  for (const row of (active.data ?? []) as DraftRow[])
    await reclaimRemoved(row);
  return { scanned: data?.length ?? 0, removed, failed };
}

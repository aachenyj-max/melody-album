import type { CreationSnapshot, CreationDraft } from "./contract";
import type { ConfirmedMemory } from "@/components/music-album/creation-session";
export async function creationApi<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message || "暂时无法处理，请重试。");
  return result as T;
}
export async function snapshotInput(
  draftId: string,
  snapshotId: string,
): Promise<ConfirmedMemory> {
  const snapshot = await creationApi<
    CreationSnapshot & { photos: CreationDraft["photos"] }
  >(`/api/creation/drafts/${draftId}/snapshot?snapshotId=${snapshotId}`);
  const photos = await Promise.all(
    snapshot.photos.map(async (photo) => {
      const response = await fetch(photo.url, { cache: "no-store" });
      if (!response.ok) throw new Error("照片暂时无法恢复，请重试。");
      return new File(
        [await response.blob()],
        photo.name || `${photo.id}.jpg`,
        { type: photo.mime },
      );
    }),
  );
  return {
    profile: snapshot.memory,
    musicProfile: snapshot.music,
    photos,
    draftId,
    snapshotId,
  };
}

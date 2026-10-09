import { creationRoute, privateHeaders } from "@/lib/creation/http";
import { uuid, CreationError } from "@/lib/creation/contract";
import { publicDraft, readDraft } from "@/lib/creation/repository";
import { preparePhotos, commitPhotos, loadPhoto } from "@/lib/creation/photos";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return creationRoute(request, async (owner, raw) => {
    const row = await readDraft(owner, uuid((await context.params).id));
    if (raw.action === "prepare") {
      const result = await preparePhotos(row, raw);
      return { draft: publicDraft(result.row), photos: result.photos };
    }
    if (raw.action === "commit") {
      const result = await commitPhotos(row, raw);
      return { draft: publicDraft(result.row), turnId: result.turnId };
    }
    throw new CreationError("INVALID_INPUT", "照片操作无效。");
  });
}
export async function GET(request: Request, context: Context) {
  return creationRoute(request, async (owner) => {
    const row = await readDraft(owner, uuid((await context.params).id));
    const id = uuid(new URL(request.url).searchParams.get("photoId"));
    const visible =
      row.state.photoIds.includes(id) ||
      row.state.snapshots.some((s) => s.photoIds.includes(id));
    const photo = row.state.photos.find((p) => p.id === id);
    if (!photo || !visible)
      throw new CreationError("NOT_FOUND", "照片不存在。", 404);
    return new Response((await loadPhoto(photo)).buffer as ArrayBuffer, {
      headers: {
        ...privateHeaders,
        "content-type": photo.mime,
        "x-content-type-options": "nosniff",
      },
    });
  });
}

import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";
import {
  AlbumSaveError,
  completeAlbumTransfer,
  saveAlbum,
} from "@/lib/albums/save";
import { listAlbums } from "@/lib/albums/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function GET() {
  try {
    const identity = await getAlbumIdentity();
    if (!identity) return Response.json({ albums: [] }, { headers });
    return Response.json(
      { albums: await listAlbums(identity.ownerKey) },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "音乐记忆暂时无法读取，请重试。" },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请求来源无效。" }, { status: 403, headers });
  const json =
    request.headers.get("content-type")?.startsWith("application/json") ??
    false;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > (json ? 128 * 1024 : 55 * 1024 * 1024))
    return Response.json(
      { error: json ? "保存内容过大。" : "照片总大小不能超过 50 MiB。" },
      { status: 413, headers },
    );
  try {
    const identity = await getAlbumIdentity();
    if (!identity)
      return Response.json(
        { error: "请先建立保存会话。" },
        { status: 401, headers },
      );
    const result = json
      ? await (async () => {
          const body = await request.text();
          if (body.length > 128 * 1024)
            throw new AlbumSaveError("INVALID_INPUT", 413, "保存内容过大。 ");
          try {
            return await completeAlbumTransfer(identity, JSON.parse(body));
          } catch (error) {
            if (error instanceof SyntaxError)
              throw new AlbumSaveError("INVALID_INPUT", 400, "保存内容无效。 ");
            throw error;
          }
        })()
      : await saveAlbum(identity, await request.formData());
    return Response.json(result, {
      status: result.alreadySaved ? 200 : 201,
      headers,
    });
  } catch (error) {
    if (error instanceof AlbumSaveError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    return Response.json(
      { error: "保存暂时失败，请重试。" },
      { status: 503, headers },
    );
  }
}

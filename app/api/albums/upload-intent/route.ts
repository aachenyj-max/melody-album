import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";
import { AlbumSaveError } from "@/lib/albums/save";
import { startAlbumUpload } from "@/lib/albums/upload-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请求来源无效。" }, { status: 403, headers });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 128 * 1024)
    return Response.json({ error: "保存内容过大。" }, { status: 413, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "保存格式无效。" }, { status: 400, headers });
  try {
    const identity = await getAlbumIdentity();
    if (!identity)
      return Response.json(
        { error: "请先建立保存会话。" },
        { status: 401, headers },
      );
    const raw = await request.text();
    if (raw.length > 128 * 1024)
      return Response.json(
        { error: "保存内容过大。" },
        { status: 413, headers },
      );
    return Response.json(await startAlbumUpload(identity, JSON.parse(raw)), {
      headers,
    });
  } catch (error) {
    if (error instanceof AlbumSaveError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "保存内容无效。" },
        { status: 400, headers },
      );
    return Response.json(
      { error: "暂时无法上传照片，请重试。" },
      { status: 503, headers },
    );
  }
}

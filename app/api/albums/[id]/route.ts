import { albumIdPattern } from "@/lib/albums/contract";
import { getAlbumIdentity } from "@/lib/albums/identity";
import { getAlbum } from "@/lib/albums/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!albumIdPattern.test(id))
    return Response.json(
      { error: "找不到这段音乐记忆。" },
      { status: 404, headers },
    );
  try {
    const identity = await getAlbumIdentity();
    if (!identity)
      return Response.json(
        { error: "找不到这段音乐记忆。" },
        { status: 404, headers },
      );
    const album = await getAlbum(identity.ownerKey, id);
    if (!album)
      return Response.json(
        { error: "找不到这段音乐记忆。" },
        { status: 404, headers },
      );
    return Response.json({ album }, { headers });
  } catch {
    return Response.json(
      { error: "相册暂时无法读取，请重试。" },
      { status: 503, headers },
    );
  }
}

import { ALBUM_BUCKET, albumIdPattern } from "@/lib/albums/contract";
import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";
import { albumAdmin, getAlbum } from "@/lib/albums/repository";

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

async function mutateAlbum(
  request: Request,
  params: Promise<{ id: string }>,
  remove: boolean,
) {
  if (!sameOrigin(request))
    return Response.json({ error: "请求来源无效。" }, { status: 403, headers });
  const { id } = await params;
  if (!albumIdPattern.test(id))
    return Response.json(
      { error: "找不到这段音乐记忆。" },
      { status: 404, headers },
    );
  let edit: { title: string; caption: string } | undefined;
  if (!remove) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json(
        { error: "编辑内容无效。" },
        { status: 400, headers },
      );
    const text = await request.text();
    if (text.length > 4096)
      return Response.json(
        { error: "编辑内容过大。" },
        { status: 413, headers },
      );
    try {
      const body = JSON.parse(text);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !["title", "caption"].includes(key)) ||
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > 80 ||
        typeof body.caption !== "string" ||
        body.caption.trim().length > 300
      )
        throw new Error("INVALID_INPUT");
      edit = { title: body.title.trim(), caption: body.caption.trim() };
    } catch {
      return Response.json(
        { error: "标题需为 1–80 字，一句话记忆不能超过 300 字。" },
        { status: 400, headers },
      );
    }
  }
  try {
    const identity = await getAlbumIdentity();
    if (!identity)
      return Response.json(
        { error: "找不到这段音乐记忆。" },
        { status: 404, headers },
      );
    const db = albumAdmin();
    const owned = await db
      .from("memory_albums")
      .select("id")
      .eq("id", id)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "ready")
      .maybeSingle();
    if (owned.error) throw new Error("ALBUM_STORE_UNAVAILABLE");
    if (!owned.data)
      return Response.json(
        { error: "找不到这段音乐记忆。" },
        { status: 404, headers },
      );
    if (remove) {
      const photos = await db
        .from("memory_album_photos")
        .select("storage_path")
        .eq("album_id", id);
      if (photos.error) throw new Error("ALBUM_STORE_UNAVAILABLE");
      const paths = (photos.data ?? []).map(
        (photo) => photo.storage_path as string,
      );
      if (paths.length) {
        const storage = await db.storage.from(ALBUM_BUCKET).remove(paths);
        if (storage.error) throw new Error("ALBUM_STORE_UNAVAILABLE");
      }
    }
    const query = remove
      ? db.from("memory_albums").delete()
      : db.from("memory_albums").update(edit!);
    const result = await query
      .eq("id", id)
      .eq("owner_key", identity.ownerKey)
      .eq("status", "ready")
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error("ALBUM_STORE_UNAVAILABLE");
    if (!result.data)
      return Response.json(
        { error: "相册已变更，请刷新后重试。" },
        { status: 409, headers },
      );
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: remove ? "删除暂时失败，请重试。" : "修改暂时失败，请重试。" },
      { status: 503, headers },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutateAlbum(request, params, false);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutateAlbum(request, params, true);
}

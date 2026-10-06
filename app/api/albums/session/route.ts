import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请求来源无效。" }, { status: 403, headers });
  try {
    const identity = await getAlbumIdentity(true);
    if (!identity) throw new Error("SESSION_UNAVAILABLE");
    return Response.json({ mode: identity.kind }, { headers });
  } catch {
    return Response.json(
      { error: "暂时无法建立保存会话，请稍后重试。" },
      { status: 503, headers },
    );
  }
}

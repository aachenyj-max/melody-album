import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredAlbumUploads } from "@/lib/albums/cleanup";
import { cleanupCreationDrafts } from "@/lib/creation/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (!secret || secret.length < 32 || !supplied)
    return new Response(null, { status: 401, headers });
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return new Response(null, { status: 401, headers });
  try {
    const result = await cleanupExpiredAlbumUploads();
    const creation = await cleanupCreationDrafts();
    return Response.json(
      { ...result, creation },
      {
        status: result.failed || creation.failed ? 503 : 200,
        headers,
      },
    );
  } catch {
    return Response.json({ error: "维护暂时失败。" }, { status: 503, headers });
  }
}

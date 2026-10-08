import { albumIdPattern } from "@/lib/albums/contract";
import { getAlbumIdentity } from "@/lib/albums/identity";
import { signedAlbumPhoto } from "@/lib/albums/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  if (!albumIdPattern.test(id) || !/^[0-8]$/.test(index))
    return new Response(null, { status: 404, headers });
  try {
    const identity = await getAlbumIdentity();
    if (!identity) return new Response(null, { status: 404, headers });
    const signedUrl = await signedAlbumPhoto(
      identity.ownerKey,
      id,
      Number(index),
    );
    if (!signedUrl) return new Response(null, { status: 404, headers });
    return new Response(null, {
      status: 302,
      headers: { ...headers, location: signedUrl },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

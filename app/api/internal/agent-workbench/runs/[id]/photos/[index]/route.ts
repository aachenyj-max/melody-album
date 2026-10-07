import { requireHuman } from "@/lib/workbench/auth";
import { uuid } from "@/lib/workbench/contract";
import { endpoint, privateHeaders, queryFields } from "@/lib/workbench/http";
import { getPhoto } from "@/lib/workbench/repository";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  return endpoint(async () => {
    await requireHuman();
    queryFields(request, []);
    const { id, index } = await params;
    const photo = await getPhoto(uuid(id), index);
    return new Response(photo, {
      headers: { ...privateHeaders, "Content-Type": "image/jpeg" },
    });
  });
}

import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { createDraft, publicDraft } from "@/lib/creation/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return creationRoute(
    request,
    async (owner, raw) =>
      publicDraft(await createDraft(owner, uuid(raw.requestId))),
    true,
  );
}

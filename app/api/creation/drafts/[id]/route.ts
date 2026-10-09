import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { publicDraft, readDraft } from "@/lib/creation/repository";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return creationRoute(request, async (owner) =>
    publicDraft(await readDraft(owner, uuid((await context.params).id))),
  );
}

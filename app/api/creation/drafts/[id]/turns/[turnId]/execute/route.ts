import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { publicDraft } from "@/lib/creation/repository";
import { executeTurn } from "@/lib/creation/dialogue";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; turnId: string }> },
) {
  return creationRoute(request, async (owner) => {
    const { id, turnId } = await context.params;
    return publicDraft(
      await executeTurn(owner, uuid(id), uuid(turnId), request),
    );
  });
}

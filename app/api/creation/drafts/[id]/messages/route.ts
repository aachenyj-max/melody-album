import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { publicDraft, readDraft } from "@/lib/creation/repository";
import { receiveMessage } from "@/lib/creation/dialogue";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return creationRoute(request, async (owner, raw) => {
    const result = await receiveMessage(
      await readDraft(owner, uuid((await context.params).id)),
      raw,
    );
    return { draft: publicDraft(result.row), turnId: result.turnId };
  });
}

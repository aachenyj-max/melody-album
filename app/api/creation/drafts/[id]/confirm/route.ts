import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { readDraft } from "@/lib/creation/repository";
import { confirmDirection } from "@/lib/creation/confirmation";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return creationRoute(request, async (owner, raw) =>
    confirmDirection(
      await readDraft(owner, uuid((await context.params).id)),
      raw,
    ),
  );
}

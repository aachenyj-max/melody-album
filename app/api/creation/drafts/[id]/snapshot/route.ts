import { creationRoute } from "@/lib/creation/http";
import { uuid } from "@/lib/creation/contract";
import { readSnapshot } from "@/lib/creation/confirmation";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return creationRoute(request, async (owner) =>
    readSnapshot(
      owner,
      uuid((await context.params).id),
      uuid(new URL(request.url).searchParams.get("snapshotId")),
    ),
  );
}

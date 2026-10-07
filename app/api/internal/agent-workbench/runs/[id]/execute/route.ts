import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import { assertVersion, readJson, uuid } from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { executeRun } from "@/lib/workbench/runner";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requireHuman();
    requireOrigin(request);
    queryFields(request, []);
    assertVersion(
      (await readJson(request, ["contractVersion"])).contractVersion,
    );
    return response(await executeRun(uuid((await params).id), request.signal));
  });
}

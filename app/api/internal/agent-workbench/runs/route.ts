import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import { endpoint, response } from "@/lib/workbench/http";
import { createRun, listRuns, parseUpload } from "@/lib/workbench/repository";
import { createDialogue } from "@/lib/workbench/dialogue";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    await requireHuman();
    return response(await listRuns(new URL(request.url).searchParams));
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    await requireHuman();
    requireOrigin(request);
    const input = await parseUpload(request);
    const result = await createRun(input);
    if (input.chatMode) await createDialogue(result.detail.runId);
    return response(result.detail, result.created ? 201 : 200);
  });
}

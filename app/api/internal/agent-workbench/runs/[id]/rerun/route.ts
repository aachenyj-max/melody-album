import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import { activeConfig, assertExecutable } from "@/lib/workbench/config";
import {
  assertVersion,
  readJson,
  uuid,
  WorkbenchError,
} from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRun, rerunRecord } from "@/lib/workbench/repository";
import { createDialogue } from "@/lib/workbench/dialogue";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requireHuman();
    requireOrigin(request);
    queryFields(request, []);
    const body = await readJson(request, [
      "contractVersion",
      "requestId",
      "configSelection",
    ]);
    assertVersion(body.contractVersion);
    const selection = body.configSelection ?? "current";
    if (selection !== "current" && selection !== "original")
      throw new WorkbenchError("INVALID_INPUT", "配置选择无效。");
    const id = uuid((await params).id);
    const original = await getRun(id);
    let config: Awaited<ReturnType<typeof activeConfig>>;
    if (selection === "original") {
      assertExecutable(original.configSnapshot, original.configDigest);
      config = original.configSnapshot;
    } else config = await activeConfig();
    const result = await rerunRecord(id, uuid(body.requestId), config);
    if (original.inputSnapshot.chatMode)
      await createDialogue(result.detail.runId);
    return response(result.detail, result.created ? 201 : 200);
  });
}

import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import { assertExecutable, currentConfig } from "@/lib/workbench/config";
import {
  assertVersion,
  readJson,
  uuid,
  WorkbenchError,
} from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRun, rerunRecord } from "@/lib/workbench/repository";
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
    let config: Awaited<ReturnType<typeof currentConfig>>;
    if (selection === "original") {
      assertExecutable(original.configSnapshot, original.configDigest);
      config = original.configSnapshot;
    } else config = currentConfig();
    const result = await rerunRecord(id, uuid(body.requestId), config);
    return response(result.detail, result.created ? 201 : 200);
  });
}

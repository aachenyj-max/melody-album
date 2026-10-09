import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import {
  assertVersion,
  readJson,
  uuid,
  WorkbenchError,
} from "@/lib/workbench/contract";
import {
  confirmDialogueIntent,
  getDialogue,
  proposeDialogueIntent,
  sendDialogueMessage,
  syncInitialDialogueVersion,
} from "@/lib/workbench/dialogue";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { executeRun } from "@/lib/workbench/runner";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requireHuman();
    queryFields(request, []);
    return response(await getDialogue(uuid((await params).id)));
  });
}
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
      "action",
      "message",
    ]);
    assertVersion(body.contractVersion);
    const id = uuid((await params).id);
    if (body.action === "message") {
      if (typeof body.message !== "string")
        throw new WorkbenchError("INVALID_INPUT", "消息内容无效。");
      return response(
        await sendDialogueMessage(id, body.message, request.signal),
      );
    }
    if (body.message !== undefined)
      throw new WorkbenchError("INVALID_INPUT", "请求字段无效。");
    if (body.action === "propose")
      return response(await proposeDialogueIntent(id, request.signal));
    if (body.action === "confirm") {
      const dialogue = await confirmDialogueIntent(id, request.signal);
      if (dialogue.phase !== "approved") return response(dialogue);
      await executeRun(id, request.signal);
      return response(await syncInitialDialogueVersion(id));
    }
    if (body.action === "resume") {
      await executeRun(id, request.signal);
      return response(await syncInitialDialogueVersion(id));
    }
    if (body.action === "sync")
      return response(await syncInitialDialogueVersion(id));
    throw new WorkbenchError("INVALID_INPUT", "未知的对话操作。");
  });
}

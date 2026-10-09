import { requireHuman, requireOrigin } from "@/lib/workbench/auth";
import {
  activeConfig,
  activeEditableConfig,
  assertExecutable,
  configDigest,
  saveEditableConfig,
} from "@/lib/workbench/config";
import {
  errorData,
  readJson,
  uuid,
  WorkbenchError,
  type ConfigSnapshot,
} from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRun } from "@/lib/workbench/repository";
import { memoryConfigDigest } from "@/lib/agent/config";
import {
  agentReleaseInfo,
  userAgentConfig,
  userAgentVersion,
} from "@/lib/agent/release";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    await requireHuman();
    const query = queryFields(request, ["originalRunId"]);
    let configSnapshot: ConfigSnapshot | null = null;
    let currentReason: string | null = null;
    let original = null;
    if (query.has("originalRunId")) {
      const run = await getRun(uuid(query.get("originalRunId")));
      let reason: string | null = null;
      try {
        assertExecutable(run.configSnapshot, run.configDigest);
      } catch (error) {
        reason = errorData(error).message;
      }
      original = {
        configSnapshot: run.configSnapshot,
        configDigest: run.configDigest,
        originalExecutable: reason === null,
        reason,
      };
    }
    try {
      configSnapshot = await activeConfig();
    } catch (error) {
      if (!original) throw error;
      currentReason = errorData(error).message;
    }
    let userAgent = null;
    let userAgentReason: string | null = null;
    try {
      userAgent = {
        configVersion: userAgentVersion(),
        ...agentReleaseInfo(await userAgentConfig(request.signal)),
      };
    } catch {
      userAgentReason = "本环境用户端的固定版本或模型配置暂不可用。";
    }
    return response({
      configSnapshot,
      configDigest: configSnapshot ? configDigest(configSnapshot) : null,
      memoryDigest: configSnapshot ? memoryConfigDigest(configSnapshot) : null,
      userAgent,
      userAgentReason,
      executable: configSnapshot !== null,
      currentReason,
      editable: await activeEditableConfig(),
      original,
    });
  });
}
export async function PUT(request: Request) {
  return endpoint(async () => {
    await requireHuman();
    requireOrigin(request);
    queryFields(request, []);
    const body = await readJson(
      request,
      [
        "expectedVersion",
        "promptText",
        "skillText",
        "maxTurns",
        "maxOutputTokens",
      ],
      64 * 1024,
    );
    if (
      typeof body.promptText !== "string" ||
      typeof body.skillText !== "string" ||
      typeof body.maxTurns !== "number" ||
      typeof body.maxOutputTokens !== "number" ||
      typeof body.expectedVersion !== "number"
    )
      throw new WorkbenchError("INVALID_INPUT", "配置字段无效。");
    const editable = await saveEditableConfig(body.expectedVersion, {
      promptText: body.promptText,
      skillText: body.skillText,
      maxTurns: body.maxTurns,
      maxOutputTokens: body.maxOutputTokens,
    });
    return response({ editable, configSnapshot: await activeConfig() });
  });
}

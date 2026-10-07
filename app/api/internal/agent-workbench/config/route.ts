import { requireHuman } from "@/lib/workbench/auth";
import {
  assertExecutable,
  configDigest,
  currentConfig,
} from "@/lib/workbench/config";
import { errorData, uuid, type ConfigSnapshot } from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRun } from "@/lib/workbench/repository";
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
      configSnapshot = currentConfig();
    } catch (error) {
      if (!original) throw error;
      currentReason = errorData(error).message;
    }
    return response({
      configSnapshot,
      configDigest: configSnapshot ? configDigest(configSnapshot) : null,
      executable: configSnapshot !== null,
      currentReason,
      original,
    });
  });
}

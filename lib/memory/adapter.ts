import "server-only";
import { understandWithPi, type MemoryInputs } from "@/lib/agent/pi-runtime";
import { agentReleaseInfo, userAgentConfig } from "@/lib/agent/release";
import { WorkbenchError } from "@/lib/workbench/contract";
import type { MemoryProfile } from "./contract";
import { MemoryRequestError } from "./request";

async function executeMemory(
  request: Request,
  photos: File[],
  story: string,
  revision?: MemoryInputs["revision"],
) {
  try {
    const config = await userAgentConfig(request.signal);
    // Fault scenarios are available only in explicit demo mode on a local dev server.
    if (
      config.memoryModel.mode === "demo" &&
      process.env.NODE_ENV === "development"
    ) {
      const scenario = request.headers.get("X-Demo-Scenario");
      if (scenario === "timeout") throw new MemoryRequestError("AGENT_TIMEOUT");
      if (scenario === "unavailable")
        throw new MemoryRequestError("AGENT_UNAVAILABLE");
      if (scenario === "invalid-result")
        throw new MemoryRequestError("INVALID_RESULT");
      if (scenario === "revision-unclear" && revision)
        throw new MemoryRequestError("REVISION_UNCLEAR");
    }
    const inputs: MemoryInputs = {
      story,
      photos: await Promise.all(
        photos.map(async (photo) => new Uint8Array(await photo.arrayBuffer())),
      ),
      ...(revision ? { revision } : {}),
    };
    // Persistence/tracing belong to the caller. Public calls never write workbench records.
    const result = await understandWithPi(
      config,
      inputs,
      request.signal,
      async () => {},
      async () => {},
    );
    return { profile: result.profile, agent: agentReleaseInfo(config) };
  } catch (error) {
    if (error instanceof MemoryRequestError) throw error;
    if (request.signal.aborted) throw new MemoryRequestError("AGENT_TIMEOUT");
    if (error instanceof WorkbenchError) {
      if (error.code === "MEMORY_TIMEOUT")
        throw new MemoryRequestError("AGENT_TIMEOUT");
      if (error.code === "INVALID_MEMORY_RESULT")
        throw new MemoryRequestError("INVALID_RESULT");
      if (error.code === "REVISION_UNCLEAR")
        throw new MemoryRequestError("REVISION_UNCLEAR");
    }
    // Provider errors, credentials and internal traces must not reach public responses.
    throw new MemoryRequestError("AGENT_UNAVAILABLE");
  }
}
export async function understandMemory(
  request: Request,
  photos: File[],
  story: string,
) {
  return executeMemory(request, photos, story);
}
export async function reviseMemory(
  request: Request,
  photos: File[],
  story: string,
  profile: MemoryProfile,
  instruction: string,
) {
  return executeMemory(request, photos, story, { profile, instruction });
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkbenchError, type ConfigSnapshot } from "@/lib/workbench/contract";
import {
  applyEditableConfig,
  createAgentConfig,
  executionMode,
  memoryConfigDigest,
} from "./config";

// A deployment selects one immutable version. Never follow the workbench's active draft.
export function userAgentVersion(): number {
  const value = process.env.USER_AGENT_CONFIG_VERSION?.trim() || "0";
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "用户端 Agent 版本配置无效。",
      503,
    );
  return Number(value);
}
export async function userAgentConfig(
  signal?: AbortSignal,
): Promise<ConfigSnapshot> {
  const version = userAgentVersion();
  const config = createAgentConfig(
    executionMode(process.env.USER_AGENT_MODE ?? process.env.PI_EXECUTION_MODE),
  );
  if (version === 0) return config;
  const { data, error } = await createAdminClient(signal)
    .from("agent_workbench_config_versions")
    .select("version,prompt_text,skill_text,max_turns,max_output_tokens")
    .eq("version", version)
    .maybeSingle();
  if (error || !data)
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "用户端固定的 Agent 版本不可用。",
      503,
    );
  return applyEditableConfig(config, {
    version: data.version,
    promptText: data.prompt_text,
    skillText: data.skill_text,
    maxTurns: data.max_turns,
    maxOutputTokens: data.max_output_tokens,
  });
}
export function agentReleaseInfo(config: ConfigSnapshot) {
  return {
    promptVersion: config.prompt.version,
    mode: config.memoryModel.mode,
    digest: memoryConfigDigest(config),
  };
}

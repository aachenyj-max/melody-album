import "server-only";
import { liveDescriptor } from "@/lib/agent/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkbenchError, type ConfigSnapshot } from "./contract";
import {
  MEMORY_PROMPT as PROMPT,
  MEMORY_SKILL as SKILL,
  canonical,
  sha256,
  executionMode,
  demoDescriptor,
  createAgentConfig,
  applyEditableConfig,
  type EditableConfig,
} from "@/lib/agent/config";
export {
  canonical,
  sha256,
  applyEditableConfig,
  type EditableConfig,
} from "@/lib/agent/config";
export function configDigest(value: ConfigSnapshot) {
  return sha256(canonical(value));
}
export function currentConfig(): ConfigSnapshot {
  const memoryMode = executionMode(process.env.PI_EXECUTION_MODE);
  const musicMode = executionMode(process.env.WORKBENCH_MUSIC_MODE);
  if (musicMode === "live" && !process.env.FAL_KEY?.trim())
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "真实配乐需要服务端 FAL_KEY。",
      503,
    );
  return createAgentConfig(memoryMode, musicMode);
}
type ConfigRow = {
  version: number;
  prompt_text: string;
  skill_text: string;
  max_turns: number;
  max_output_tokens: number;
};
function rowToEditable(row: ConfigRow): EditableConfig {
  return {
    version: row.version,
    promptText: row.prompt_text,
    skillText: row.skill_text,
    maxTurns: row.max_turns,
    maxOutputTokens: row.max_output_tokens,
  };
}
export async function activeEditableConfig(): Promise<EditableConfig> {
  const { data, error } = await createAdminClient()
    .from("agent_workbench_config_versions")
    .select("version,prompt_text,skill_text,max_turns,max_output_tokens")
    .eq("active", true)
    .maybeSingle();
  if (error)
    throw new WorkbenchError("DATA_UNAVAILABLE", "读取工作台配置失败。", 503);
  return data
    ? rowToEditable(data as ConfigRow)
    : {
        version: 0,
        promptText: PROMPT,
        skillText: SKILL,
        maxTurns: 3,
        maxOutputTokens: 2048,
      };
}
export async function activeConfig(): Promise<ConfigSnapshot> {
  const base = currentConfig();
  const edit = await activeEditableConfig();
  return edit.version === 0 ? base : applyEditableConfig(base, edit);
}
export async function saveEditableConfig(
  expectedVersion: number,
  value: Omit<EditableConfig, "version">,
): Promise<EditableConfig> {
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    value.promptText.trim().length < 20 ||
    value.promptText.length > 8000 ||
    value.skillText.trim().length < 20 ||
    value.skillText.length > 8000 ||
    !Number.isInteger(value.maxTurns) ||
    value.maxTurns < 1 ||
    value.maxTurns > 3 ||
    !Number.isInteger(value.maxOutputTokens) ||
    value.maxOutputTokens < 512 ||
    value.maxOutputTokens > 2048
  )
    throw new WorkbenchError("INVALID_INPUT", "配置内容或预算超出允许范围。");
  const { data, error } = await createAdminClient().rpc(
    "agent_workbench_config_save",
    {
      p_expected_version: expectedVersion,
      p_prompt: value.promptText.trim(),
      p_skill: value.skillText.trim(),
      p_max_turns: value.maxTurns,
      p_max_output_tokens: value.maxOutputTokens,
    },
  );
  if (error)
    throw new WorkbenchError(
      error.message.includes("CONFIG_CONFLICT")
        ? "CONFIG_CONFLICT"
        : "DATA_UNAVAILABLE",
      error.message.includes("CONFIG_CONFLICT")
        ? "配置已被其他人更新，请刷新后重试。"
        : "保存配置失败。",
      error.message.includes("CONFIG_CONFLICT") ? 409 : 503,
    );
  return rowToEditable(data as ConfigRow);
}
export function assertExecutable(snapshot: ConfigSnapshot, digest: string) {
  if (!snapshot || configDigest(snapshot) !== digest)
    throw new WorkbenchError("CONFIG_UNAVAILABLE", "历史配置摘要不匹配。", 409);
  // Registered text and implementations are code-owned; historical JSON never selects executable code.
  const template = currentTemplate(
    snapshot.tools?.find((item) => item.name === "record_memory_profile")
      ?.version === "1"
      ? "1"
      : "2",
  );
  for (const key of [
    "schemaVersion",
    "engine",
    "tools",
    "contractVersions",
    "runTimeoutMs",
    "recommendation",
  ] as const) {
    if (canonical(snapshot[key]) !== canonical(template[key]))
      throw new WorkbenchError(
        "CONFIG_UNAVAILABLE",
        `历史配置的 ${key} 版本已不支持。`,
        409,
      );
  }
  const prompt = snapshot.prompt;
  const skill = snapshot.skills?.[0];
  if (
    !prompt ||
    typeof prompt.text !== "string" ||
    prompt.text.length < 20 ||
    prompt.text.length > 8000 ||
    prompt.sha256 !== sha256(prompt.text) ||
    !Array.isArray(snapshot.skills) ||
    snapshot.skills.length !== 1 ||
    skill?.name !== "memory-understanding" ||
    typeof skill.text !== "string" ||
    skill.text.length < 20 ||
    skill.text.length > 8000 ||
    skill.sha256 !== sha256(skill.text) ||
    !Number.isInteger(snapshot.loop?.maxTurns) ||
    snapshot.loop.maxTurns < 1 ||
    snapshot.loop.maxTurns > 3 ||
    !Number.isInteger(snapshot.loop.maxOutputTokens) ||
    snapshot.loop.maxOutputTokens < 512 ||
    snapshot.loop.maxOutputTokens > 2048 ||
    snapshot.loop.memoryTimeoutMs !== 45000 ||
    (!/^workbench-prompt-\d+$/.test(prompt.version) &&
      prompt.version !== "memory-prompt-1") ||
    (!/^workbench-skill-\d+$/.test(skill.version) && skill.version !== "1") ||
    (!/^workbench-loop-\d+$/.test(snapshot.loop.version) &&
      snapshot.loop.version !== "bounded-loop-1")
  )
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "历史提示词或预算快照无效。",
      409,
    );
  if (
    !["demo", "live"].includes(snapshot.music?.mode) ||
    snapshot.music.adapterVersion !== template.music.adapterVersion ||
    snapshot.music.modelId !== template.music.modelId
  )
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "历史配乐版本已不支持。",
      409,
    );
  if (snapshot.music.mode === "live" && !process.env.FAL_KEY?.trim())
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "原版真实配乐凭证不可用。",
      409,
    );
  if (snapshot.memoryModel?.mode === "demo") {
    if (canonical(snapshot.memoryModel) !== canonical(demoDescriptor))
      throw new WorkbenchError(
        "CONFIG_UNAVAILABLE",
        "历史演示模型已不支持。",
        409,
      );
  } else if (snapshot.memoryModel?.mode === "live") {
    try {
      if (canonical(snapshot.memoryModel) !== canonical(liveDescriptor()))
        throw new Error();
    } catch {
      throw new WorkbenchError(
        "CONFIG_UNAVAILABLE",
        "当前凭证或模型能力无法执行原版理解。",
        409,
      );
    }
  } else
    throw new WorkbenchError("CONFIG_UNAVAILABLE", "历史模型模式无效。", 409);
}
function currentTemplate(recordToolVersion: "1" | "2" = "2"): ConfigSnapshot {
  const template = createAgentConfig("demo");
  template.tools[0].version = recordToolVersion;
  return template;
}

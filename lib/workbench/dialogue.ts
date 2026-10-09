import "server-only";
import { randomUUID } from "node:crypto";
import { Agent } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { understandWithPi } from "@/lib/agent/pi-runtime";
import { createDemoModel } from "@/lib/agent/demo-provider";
import { createLiveModel } from "@/lib/agent/models";
import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";
import { validateMusicProfile, type MusicProfile } from "@/lib/music/contract";
import { generateMusic } from "@/lib/music/generator";
import { toMusicProfile } from "@/lib/music/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHuman } from "./auth";
import { assertExecutable } from "./config";
import { WorkbenchError, type ConfigSnapshot, type Json } from "./contract";
import { getRun, loadInputs } from "./repository";

export type DialogueMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
};
export type DialogueProposal = {
  kind: "initial" | "adjustment";
  memory: MemoryProfile;
  music: MusicProfile;
  summary: string;
};
export type DialogueVersion = {
  id: string;
  createdAt: string;
  proposal: DialogueProposal;
  result: Json;
};
export type Dialogue = {
  runId: string;
  phase: "discussing" | "proposed" | "approved" | "generated";
  messages: DialogueMessage[];
  proposal: DialogueProposal | null;
  musicVersions: DialogueVersion[];
  revision: number;
};
type DialogueRow = {
  run_id: string;
  phase: Dialogue["phase"];
  messages: DialogueMessage[];
  proposal: DialogueProposal | null;
  music_versions: DialogueVersion[];
  revision: number;
};
const dto = (row: DialogueRow): Dialogue => ({
  runId: row.run_id,
  phase: row.phase,
  messages: row.messages,
  proposal: row.proposal,
  musicVersions: row.music_versions,
  revision: row.revision,
});
function dataError(error: { message: string }): never {
  if (error.message.includes("DIALOGUE_BUSY"))
    throw new WorkbenchError(
      "DIALOGUE_BUSY",
      "上一条消息仍在处理中，请稍后再试。",
      409,
    );
  if (error.message.includes("DIALOGUE_CONFLICT"))
    throw new WorkbenchError(
      "DIALOGUE_CONFLICT",
      "对话状态已变化，请刷新后重试。",
      409,
    );
  if (error.message.includes("NOT_FOUND"))
    throw new WorkbenchError("NOT_FOUND", "对话不存在或已过期。", 404);
  throw new WorkbenchError("DATA_UNAVAILABLE", "对话暂时无法保存。", 503);
}
export async function createDialogue(runId: string) {
  await requireHuman();
  const { error } = await createAdminClient()
    .from("agent_workbench_dialogues")
    .insert({ run_id: runId });
  if (error && error.code !== "23505") dataError(error);
  return getDialogue(runId);
}
export async function getDialogue(runId: string): Promise<Dialogue> {
  await requireHuman();
  await getRun(runId);
  const { data, error } = await createAdminClient()
    .from("agent_workbench_dialogues")
    .select("run_id,phase,messages,proposal,music_versions,revision")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) dataError(error);
  if (!data) throw new WorkbenchError("NOT_FOUND", "此运行没有对话。", 404);
  return dto(data as DialogueRow);
}
async function claim(runId: string) {
  const { data, error } = await createAdminClient().rpc(
    "agent_workbench_dialogue_claim",
    {
      p_id: runId,
      p_token: randomUUID(),
    },
  );
  if (error) dataError(error);
  const row = data as DialogueRow & { lease_token: string };
  return { dialogue: dto(row), token: row.lease_token };
}
async function commit(
  runId: string,
  token: string,
  value: Omit<Dialogue, "runId" | "revision">,
) {
  const { data, error } = await createAdminClient().rpc(
    "agent_workbench_dialogue_commit",
    {
      p_id: runId,
      p_token: token,
      p_phase: value.phase,
      p_messages: value.messages,
      p_proposal: value.proposal,
      p_music_versions: value.musicVersions,
    },
  );
  if (error) dataError(error);
  return dto(data as DialogueRow);
}
async function leased<T>(
  runId: string,
  action: (dialogue: Dialogue, token: string) => Promise<T>,
): Promise<T> {
  const { dialogue, token } = await claim(runId);
  try {
    return await action(dialogue, token);
  } catch (error) {
    await createAdminClient().rpc("agent_workbench_dialogue_release", {
      p_id: runId,
      p_token: token,
    });
    throw error;
  }
}
const stamp = (
  role: DialogueMessage["role"],
  text: string,
): DialogueMessage => ({
  role,
  text,
  at: new Date().toISOString(),
});
async function chatWithPi(
  config: ConfigSnapshot,
  messages: DialogueMessage[],
  photos: Uint8Array[],
  signal: AbortSignal,
) {
  if (config.memoryModel.mode === "demo") {
    // Demo mode remains explicit and does not claim to be a model answer.
    return `演示对话：我记录了你的想法“${messages.at(-1)?.text.slice(0, 80)}”。可以继续补充，准备好后点击“整理音乐意图”。`;
  }
  const runtime = createLiveModel(config);
  const timeout = AbortSignal.timeout(config.loop.memoryTimeoutMs);
  const combined = AbortSignal.any([signal, timeout]);
  const prior = messages.slice(0, -1).map((message, index) =>
    message.role === "user"
      ? {
          role: "user" as const,
          content:
            index === 0
              ? [
                  { type: "text" as const, text: message.text },
                  ...photos.map((bytes) => ({
                    type: "image" as const,
                    mimeType: "image/jpeg",
                    data: Buffer.from(bytes).toString("base64"),
                  })),
                ]
              : message.text,
          timestamp: Date.parse(message.at),
        }
      : fauxAssistantMessage(message.text),
  );
  const agent = new Agent({
    initialState: {
      messages: [
        {
          role: "system",
          content: `${config.prompt.text}\n\n${config.skills.map((skill) => skill.text).join("\n")}\n\n你正在与内部测试者讨论照片和音乐意图。每次简短回应或追问；不要声称已生成音乐。音乐生成必须由用户确认界面上的意图摘要后触发。`,
          timestamp: Date.now(),
        },
        ...prior,
      ],
      model: runtime.model,
      tools: [],
      thinkingLevel: "off",
    },
    streamFn: (model, context, options) =>
      runtime.models.streamSimple(model, context, {
        ...options,
        maxTokens: config.loop.maxOutputTokens,
        signal: AbortSignal.any([
          combined,
          ...(options?.signal ? [options.signal] : []),
        ]),
      }),
    getApiKey: () => process.env.PI_LLM_API_KEY,
  });
  combined.addEventListener("abort", () => agent.abort(), { once: true });
  const last = messages.at(-1);
  if (!last) throw new WorkbenchError("INVALID_INPUT", "对话消息为空。");
  await agent.prompt(
    last.text,
    messages.length === 1
      ? photos.map((bytes) => ({
          type: "image",
          mimeType: "image/jpeg",
          data: Buffer.from(bytes).toString("base64"),
        }))
      : undefined,
  );
  if (combined.aborted || agent.state.errorMessage)
    throw new WorkbenchError(
      "PROVIDER_UNAVAILABLE",
      "Agent 本轮未能回复，请重试。",
      503,
      "memory",
      true,
    );
  const answer = [...agent.state.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const text =
    answer?.role === "assistant"
      ? answer.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim()
      : "";
  if (!text)
    throw new WorkbenchError(
      "PROVIDER_UNAVAILABLE",
      "Agent 返回了空回复。",
      503,
      "memory",
      true,
    );
  return text.slice(0, 4000);
}
export async function sendDialogueMessage(
  runId: string,
  message: string,
  signal: AbortSignal,
) {
  await requireHuman();
  const text = message.trim();
  if (!text || text.length > 1000)
    throw new WorkbenchError("INVALID_INPUT", "请输入 1–1000 字的消息。");
  const run = await getRun(runId);
  assertExecutable(run.configSnapshot, run.configDigest);
  return leased(runId, async (dialogue, token) => {
    if (
      dialogue.phase === "approved" ||
      (!dialogue.musicVersions.length && run.status !== "queued")
    )
      throw new WorkbenchError(
        "INVALID_INPUT",
        "当前运行正在生成或已结束，请刷新后重试。",
      );
    if (dialogue.messages.length >= 78)
      throw new WorkbenchError(
        "INVALID_INPUT",
        "本次对话已达到 40 轮上限，请新建测试。",
      );
    const nextMessages = [...dialogue.messages, stamp("user", text)];
    const inputs = await loadInputs(runId);
    const answer = await chatWithPi(
      run.configSnapshot,
      nextMessages,
      inputs.photos,
      signal,
    );
    return commit(runId, token, {
      phase: dialogue.musicVersions.length ? "generated" : "discussing",
      messages: [...nextMessages, stamp("assistant", answer)],
      proposal: null,
      musicVersions: dialogue.musicVersions,
    });
  });
}
export async function proposeDialogueIntent(
  runId: string,
  signal: AbortSignal,
) {
  await requireHuman();
  const run = await getRun(runId);
  assertExecutable(run.configSnapshot, run.configDigest);
  return leased(runId, async (dialogue, token) => {
    if (!dialogue.messages.some((message) => message.role === "user"))
      throw new WorkbenchError("INVALID_INPUT", "请先与 Agent 讨论至少一轮。");
    const inputs = await loadInputs(runId);
    const story = [
      inputs.story,
      ...dialogue.messages.map(
        (m) => `${m.role === "user" ? "用户" : "Agent"}：${m.text}`,
      ),
    ]
      .join("\n")
      .slice(-5000);
    const result = await understandWithPi(
      run.configSnapshot,
      {
        story,
        photos: inputs.photos,
        ...(dialogue.musicVersions.length
          ? {
              revision: {
                profile: dialogue.musicVersions.at(-1)!.proposal.memory,
                instruction: dialogue.messages
                  .filter((message) => message.role === "user")
                  .slice(-4)
                  .map((message) => message.text)
                  .join("；"),
              },
            }
          : {}),
      },
      signal,
      async () => {},
      async () => {},
    );
    const profile = normalizeProfile(result.profile, inputs.photos.length);
    if (!profile)
      throw new WorkbenchError(
        "INVALID_MEMORY_RESULT",
        "Agent 未能整理有效意图。",
        422,
      );
    const music = toMusicProfile(profile);
    const recentUser = dialogue.messages
      .filter((m) => m.role === "user")
      .slice(-4)
      .map((m) => m.text)
      .join("；");
    music.instrumentalPrompt =
      `${music.instrumentalPrompt} 按用户讨论调整：${recentUser.slice(0, 240)}。保持无歌词、无人声。`.slice(
        0,
        600,
      );
    const validated = validateMusicProfile(music);
    if (!validated)
      throw new WorkbenchError(
        "INVALID_MEMORY_RESULT",
        "音乐意图无法校验。",
        422,
      );
    const proposal: DialogueProposal = {
      kind: dialogue.musicVersions.length ? "adjustment" : "initial",
      memory: profile,
      music: validated,
      summary: `${profile.title} · ${validated.mood} · ${validated.style} · ${validated.tempo}`,
    };
    return commit(runId, token, { ...dialogue, phase: "proposed", proposal });
  });
}
export async function approvedInitialProposal(runId: string) {
  const dialogue = await getDialogue(runId);
  return dialogue.phase === "approved" && dialogue.proposal?.kind === "initial"
    ? dialogue.proposal
    : null;
}
export async function confirmDialogueIntent(
  runId: string,
  signal: AbortSignal,
) {
  await requireHuman();
  const run = await getRun(runId);
  return leased(runId, async (dialogue, token) => {
    const proposal = dialogue.proposal;
    if (dialogue.phase !== "proposed" || !proposal)
      throw new WorkbenchError("INVALID_INPUT", "请先整理并确认最新意图。");
    if (proposal.kind === "initial") {
      if (run.status !== "queued")
        throw new WorkbenchError("INVALID_INPUT", "这条运行已开始执行。");
      return commit(runId, token, { ...dialogue, phase: "approved" });
    }
    if (run.status !== "succeeded" && run.status !== "partial")
      throw new WorkbenchError("INVALID_INPUT", "原音乐尚未生成成功。");
    if (dialogue.musicVersions.length >= 12)
      throw new WorkbenchError("INVALID_INPUT", "音乐版本已达到 12 个上限。");
    const result = await generateMusic(proposal.music, {
      mode: run.configSnapshot.music.mode,
      signal: AbortSignal.any([signal, AbortSignal.timeout(210000)]),
    });
    if (!result.ok)
      throw new WorkbenchError(
        "MUSIC_UNAVAILABLE",
        result.error.message,
        502,
        "ai_music",
        true,
      );
    const version: DialogueVersion = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      proposal,
      result: result as Json,
    };
    return commit(runId, token, {
      ...dialogue,
      phase: "generated",
      proposal: null,
      musicVersions: [...dialogue.musicVersions, version],
      messages: [
        ...dialogue.messages,
        stamp(
          "assistant",
          "已按确认的意图生成新版本。你可以继续讨论下一次修改。",
        ),
      ],
    });
  });
}
export async function syncInitialDialogueVersion(runId: string) {
  const run = await getRun(runId);
  const result = run.steps.find((step) => step.stage === "ai_music");
  if (result?.status !== "succeeded" || !result.result)
    return getDialogue(runId);
  return leased(runId, async (dialogue, token) => {
    if (dialogue.musicVersions.length || dialogue.proposal?.kind !== "initial")
      return commit(runId, token, dialogue);
    const version: DialogueVersion = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      proposal: dialogue.proposal,
      result: result.result,
    };
    return commit(runId, token, {
      ...dialogue,
      phase: "generated",
      proposal: null,
      musicVersions: [version],
      messages: [
        ...dialogue.messages,
        stamp(
          "assistant",
          "已按确认的意图生成音乐。可以继续讨论调整，再整理新的修改意图。",
        ),
      ],
    });
  });
}

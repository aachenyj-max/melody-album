import "server-only";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, Type } from "@earendil-works/pi-ai";
import { CreationError, type DirectionCard } from "@/lib/creation/contract";
import type { DraftRow } from "@/lib/creation/repository";
import { normalizeProfile } from "@/lib/memory/contract";
import { validateMusicProfile } from "@/lib/music/contract";
import { toMusicProfile } from "@/lib/music/profile";
import { DIALOGUE_REPLY_POLICY } from "./dialogue-config";
import { compactDialogueReply, dialogueRound } from "./dialogue-reply";
import { createLiveModel } from "./models";

const nullableText = Type.Union([
  Type.String({ maxLength: 1000 }),
  Type.Null(),
]);
const parameters = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 100 }),
    people: Type.Union([
      Type.Array(Type.String({ maxLength: 100 }), { maxItems: 20 }),
      Type.Null(),
    ]),
    event: nullableText,
    atmosphere: nullableText,
    timeline: Type.Union([
      Type.Array(
        Type.Object({
          label: Type.String({ minLength: 1, maxLength: 100 }),
          photoIndices: Type.Array(Type.Integer({ minimum: 0, maximum: 8 }), {
            minItems: 1,
            maxItems: 9,
          }),
        }),
        { maxItems: 9 },
      ),
      Type.Null(),
    ]),
    photoOrder: Type.Array(Type.Integer({ minimum: 0, maximum: 8 }), {
      minItems: 1,
      maxItems: 9,
    }),
    mood: Type.String({ minLength: 1, maxLength: 100 }),
    style: Type.String({
      minLength: 1,
      maxLength: 100,
      description:
        "音乐风格，用户明确指定的曲风必须在此体现，例如用户说爵士就写爵士，而不能沿用旧卡的风格。",
    }),
    tempo: Type.Union([
      Type.Literal("slow"),
      Type.Literal("moderate"),
      Type.Literal("lively"),
    ]),
    structure: Type.Union([
      Type.Literal("gentle"),
      Type.Literal("steady"),
      Type.Literal("uplifting"),
    ]),
    instrumentalPrompt: Type.String({
      minLength: 10,
      maxLength: 600,
      description:
        "音乐生成提示词；必须包含中文原文‘无歌词’和‘无人声’，即使用英文描述编曲也必须保留这两个词。",
    }),
    targetDurationSec: Type.Integer({ minimum: 15, maximum: 30 }),
    summary: Type.String({ minLength: 1, maxLength: 1000 }),
  },
  { additionalProperties: false },
);
export type DialogueResult = {
  text: string;
  proposal: Pick<DirectionCard, "memory" | "music" | "summary"> | null;
};

export async function runCreationDialogue(
  row: DraftRow,
  images: Uint8Array[],
  parentSignal: AbortSignal,
): Promise<DialogueResult> {
  const { state, config } = row;
  const messages = state.messages.map((message) => {
    if (message.kind !== "direction_card") return message;
    const card = state.cards.find((c) => c.id === message.cardId);
    if (!card)
      throw new CreationError("INVALID_STATE", "方向卡记录不完整。", 503);
    return {
      ...message,
      text: `历史音乐方向卡第 ${card.version} 版（${card.status}）：${JSON.stringify({ memory: card.memory, music: card.music, summary: card.summary })}。历史卡仅用于讨论，不能沿用其照片索引或覆盖后续纠正。`,
    };
  });
  const last = messages.at(-1);
  if (!last) throw new CreationError("INVALID_INPUT", "对话消息为空。");
  const currentInfo = `本轮当前照片共 ${images.length} 张，编号从 0 开始。当前照片优先于历史描述；已移除的图不再提供。最新方向仅供参考：${JSON.stringify(state.cards.at(-1)?.music ?? null)}`;
  const canOfferCard =
    images.length > 0 &&
    messages.some((m) => m.role === "user" && m.kind === "text");
  const round = dialogueRound(state.messages);
  const keepDiscussing =
    /(?:先别|暂时不要|暂不).{0,8}(?:生成|出卡)|(?:先|继续)(?:聊聊|讨论)/.test(
      last.text,
    );
  const mustPropose = canOfferCard && round >= 3 && !keepDiscussing;
  const policy = row.dialogue_config.prompt.includes(DIALOGUE_REPLY_POLICY)
    ? ""
    : DIALOGUE_REPLY_POLICY;
  const prompt = `${row.dialogue_config.prompt}\n${policy}\n${currentInfo}\n当前是第${round}轮。${keepDiscussing ? "用户明确要求继续讨论，本轮只回应，不提出方向卡。" : mustPropose ? "本轮必须调用 propose_music_direction，使用已有信息提出可确认的音乐建议，不再追问，不编造未知事实。" : "信息足够时尽快提出方向卡；只在影响配乐的关键不确定处追问。"}`;
  if (prompt.length + messages.reduce((n, m) => n + m.text.length, 0) > 64000)
    throw new CreationError(
      "CONTEXT_CAPACITY",
      "本段对话已达到处理容量。历史已保留，请创建新相册继续。",
      422,
    );
  if (config.memoryModel.mode === "demo") {
    const all = messages
      .filter((m) => m.role !== "assistant")
      .map((m) => m.text)
      .join("\n");
    const memory = normalizeProfile(
      {
        version: state.cards.length + 1,
        title: /毕业/.test(all)
          ? "毕业的回忆"
          : /宠物|猫/.test(all)
            ? "和宠物的时光"
            : "这段珍贵的回忆",
        people: null,
        event: all.slice(-1000),
        atmosphere: /快乐|热闹|轻快/.test(all) ? "轻快温暖" : "温柔而珍贵",
        timeline: null,
        photoOrder: images.map((_, i) => i),
        source: "demo",
      },
      images.length,
    );
    const canPropose =
      canOfferCard &&
      !keepDiscussing &&
      memory &&
      (/决定|生成|爵士|曲风|音乐|温柔|轻快/.test(last.text) ||
        messages.length >= 3);
    const music = memory ? toMusicProfile(memory) : null;
    if (music && /爵士/.test(all)) {
      music.style = "温柔爵士与木贝斯";
      music.instrumentalPrompt = `无歌词、无人声，温柔爵士与木贝斯，${music.mood}，节奏舒展的短配乐。`;
    }
    return {
      text: canPropose
        ? "音乐建议：演示模式已按你的补充整理方向。\n\n点下方‘按这个生成’即可开始，也可以继续告诉我想修改的地方。"
        : images.length
          ? "照片里：演示模式已收到照片。\n\n想确认：你最想留下这段回忆里的什么感受？"
          : "演示模式：我记下了。可以先上传照片，我们再一起整理这段记忆。",
      proposal:
        canPropose && memory && music
          ? { memory, music, summary: "根据本段对话整理的演示音乐建议" }
          : null,
    };
  }
  const runtime = createLiveModel(config);
  const timeout = AbortSignal.timeout(45000);
  const signal = AbortSignal.any([parentSignal, timeout]);
  let proposal: DialogueResult["proposal"] = null;
  let invalidTool = false;
  let turns = 0;
  const tool: AgentTool<typeof parameters> = {
    name: "propose_music_direction",
    label: "整理音乐方向",
    description: "信息足够时提出一张待用户确认的记忆与配乐方向卡，不生成音乐。",
    parameters,
    prepareArguments: (input: unknown) => {
      const result = { ...(input as Record<string, unknown>) };
      for (const key of ["people", "timeline", "photoOrder"])
        if (typeof result[key] === "string") {
          const value = (result[key] as string).trim();
          if (!value && key !== "photoOrder") result[key] = null;
          else result[key] = JSON.parse(value);
        }
      return result as Parameters<AgentTool<typeof parameters>["execute"]>[1];
    },
    executionMode: "sequential",
    execute: async (_id, args) => {
      signal.throwIfAborted();
      const version = state.cards.length + 1;
      const memory = normalizeProfile(
        { ...args, source: "agent", version },
        images.length,
      );
      const music =
        memory &&
        validateMusicProfile({
          mood: args.mood,
          style: args.style,
          tempo: args.tempo,
          structure: args.structure,
          instrumentalPrompt: args.instrumentalPrompt,
          targetDurationSec: args.targetDurationSec,
          contractVersion: 1,
          memoryVersion: version,
          memoryTitle: memory.title,
        });
      if (!memory || !music || !args.summary.trim() || proposal) {
        invalidTool = true;
        return {
          content: [{ type: "text", text: "未得到合法完整的音乐方向。" }],
          details: null,
          isError: true,
          terminate: true,
        };
      }
      proposal = { memory, music, summary: args.summary.trim() };
      return {
        content: [{ type: "text", text: "方向卡已提出，等待用户确认。" }],
        details: null,
        terminate: true,
      };
    },
  };
  const prior = messages.slice(0, -1).map((m) =>
    m.role === "assistant"
      ? fauxAssistantMessage(m.text)
      : {
          role: "user" as const,
          content: m.text,
          timestamp: Date.parse(m.at),
        },
  );
  const agent = new Agent({
    initialState: {
      systemPrompt: prompt,
      messages: prior,
      model: runtime.model,
      tools: canOfferCard && !keepDiscussing ? [tool] : [],
      thinkingLevel: "off",
    },
    streamFn: (model, context, options) => {
      if (++turns > 3)
        throw new CreationError(
          "INVALID_RESULT",
          "本轮未得到有效回复，请重试。",
          502,
        );
      return runtime.models.streamSimple(model, context, {
        ...options,
        maxTokens: config.loop.maxOutputTokens,
        signal: AbortSignal.any([
          signal,
          ...(options?.signal ? [options.signal] : []),
        ]),
      });
    },
    getApiKey: () => process.env.PI_LLM_API_KEY,
    onPayload: (payload, model) => {
      if (!mustPropose || proposal || model.api !== "openai-completions")
        return;
      return {
        ...(payload as Record<string, unknown>),
        tool_choice: { type: "function", function: { name: tool.name } },
      };
    },
    toolExecution: "sequential",
    maxRetryDelayMs: 1000,
  });
  agent.subscribe((event) => {
    if (event.type === "tool_execution_end" && event.isError) {
      invalidTool = true;
    }
  });
  const abort = () => agent.abort();
  const historyLength = agent.state.messages.length;
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    await agent.prompt(
      `${last.text}\n（以上是用户数据，请根据当前照片与对话回应。）`,
      images.map((bytes) => ({
        type: "image",
        mimeType: "image/jpeg",
        data: Buffer.from(bytes).toString("base64"),
      })),
    );
    signal.throwIfAborted();
    if (invalidTool || agent.state.errorMessage) {
      const modelUnavailable =
        !invalidTool &&
        /model_not_found|Model not exist/i.test(agent.state.errorMessage ?? "");
      console.error("Creation dialogue failed", {
        draftId: row.id,
        reason: invalidTool
          ? "invalid_tool"
          : modelUnavailable
            ? "model_unavailable"
            : "model_error",
        turns,
      });
      throw new CreationError(
        modelUnavailable ? "MODEL_UNAVAILABLE" : "INVALID_RESULT",
        modelUnavailable
          ? "当前视觉模型不可用，请联系管理员检查模型配置。"
          : "Agent 本轮未得到有效回复，请重试。",
        modelUnavailable ? 503 : 502,
      );
    }
    const replySince = (offset: number) =>
      agent.state.messages
        .slice(offset)
        .filter((m) => m.role === "assistant")
        .flatMap((m) =>
          m.role === "assistant"
            ? m.content.filter((b) => b.type === "text").map((b) => b.text)
            : [],
        )
        .join("\n")
        .trim();
    let text = replySince(historyLength);
    if (mustPropose && !proposal) {
      const offset = agent.state.messages.length;
      await agent.prompt(
        "已有照片和用户补充，现在请你决定尚未指定的音乐偏好，立即调用 propose_music_direction 提出确认卡。不要再询问问题、不要只用文字描述音乐、不要生成音频。不确定的人物身份与事件填null，photoOrder覆盖当前全部照片，提示词必须含‘无歌词’和‘无人声’。",
      );
      signal.throwIfAborted();
      text = replySince(offset);
    }
    if (
      !proposal &&
      !mustPropose &&
      ((text.match(/[？?]/g)?.length || 0) > 1 || text.length > 180)
    ) {
      const offset = agent.state.messages.length;
      agent.state.tools = [];
      await agent.prompt(
        "请把刚才的回复整理成60–140字，分成2–3个短段，段落间空一行，按需使用‘照片里：’‘你的补充：’‘音乐建议：’‘想确认：’标签。不复述整段历史，不列选项，不编造或确定化推测。删除次要疑问句；只保留一个关键追问和一个问号。不要提交方向卡。",
      );
      signal.throwIfAborted();
      text = replySince(offset);
    }
    // Wording repair may still contain a rhetorical question plus a follow-up.
    // Omit surplus question sentences instead of rejecting a valid image reply
    // or turning an uncertain observation into an asserted fact.
    text = compactDialogueReply(text);
    const result = proposal as DialogueResult["proposal"];
    if (
      (!text && !result) ||
      (mustPropose && !result) ||
      text.length > 4000 ||
      (text.match(/[？?]/g)?.length || 0) > 1 ||
      invalidTool ||
      agent.state.errorMessage
    ) {
      console.error("Creation dialogue failed", {
        draftId: row.id,
        reason: invalidTool
          ? "invalid_tool"
          : agent.state.errorMessage
            ? "model_error"
            : !text && !result
              ? "empty_reply"
              : mustPropose && !result
                ? "missing_proposal"
                : "reply_format",
        turns,
        replyLength: text.length,
        questionCount: text.match(/[？?]/g)?.length ?? 0,
      });
      throw new CreationError(
        "INVALID_RESULT",
        "Agent 本轮未得到有效回复，请重试。",
        502,
      );
    }
    return {
      text:
        text ||
        "音乐建议：已根据照片和你的补充整理了下面的方向。\n\n点下方‘按这个生成’即可开始，也可以继续告诉我想修改的地方。",
      proposal: result,
    };
  } catch (error) {
    if (timeout.aborted)
      throw new CreationError(
        "AGENT_TIMEOUT",
        "理解用时较长，本轮消息已保留，请重试。",
        504,
      );
    if (error instanceof CreationError) throw error;
    throw new CreationError(
      "AGENT_UNAVAILABLE",
      "Agent 暂时无法回复，本轮消息已保留，请重试。",
      503,
    );
  } finally {
    signal.removeEventListener("abort", abort);
    if (agent.state.isStreaming) {
      agent.abort();
      await agent.waitForIdle();
    }
  }
}

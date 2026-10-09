import "server-only";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, Type } from "@earendil-works/pi-ai";
import { createLiveModel } from "./models";
import { normalizeProfile } from "@/lib/memory/contract";
import { validateMusicProfile } from "@/lib/music/contract";
import { toMusicProfile } from "@/lib/music/profile";
import { CreationError, type DirectionCard } from "@/lib/creation/contract";
import type { DraftRow } from "@/lib/creation/repository";

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
  const prompt = `${row.dialogue_config.prompt}\n${currentInfo}`;
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
        ? "演示模式：已按你补充的内容整理音乐方向，看看下面这张确认卡。"
        : images.length
          ? "演示模式：照片已收到。你最想留下这段回忆里的什么感受？"
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
      tools: canOfferCard ? [tool] : [],
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
    if (invalidTool || agent.state.errorMessage)
      throw new CreationError(
        "INVALID_RESULT",
        "Agent 本轮未得到有效回复，请重试。",
        502,
      );
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
    if (
      !proposal &&
      ((text.match(/[？?]/g)?.length || 0) > 1 || text.length > 240)
    ) {
      const offset = agent.state.messages.length;
      await agent.prompt(
        "请把刚才的回复整理成不超过180字的一段自然中文，保留有依据的观察，不列选项、不预设曲风；如果需要追问，只保留一个最关键的问句。不要提交方向卡。",
      );
      signal.throwIfAborted();
      text = replySince(offset);
    }
    const result = proposal as DialogueResult["proposal"];
    if (
      (!text && !result) ||
      text.length > 4000 ||
      (text.match(/[？?]/g)?.length || 0) > 1 ||
      invalidTool ||
      agent.state.errorMessage
    )
      throw new CreationError(
        "INVALID_RESULT",
        "Agent 本轮未得到有效回复，请重试。",
        502,
      );
    return {
      text:
        text ||
        "我已根据这段记忆和你的配乐要求整理了下面的音乐方向，看看是否符合你的想法。",
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

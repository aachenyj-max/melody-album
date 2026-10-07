import "server-only";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";
import {
  jsonValue,
  WorkbenchError,
  type ConfigSnapshot,
  type RunEvent,
  type ToolCall,
} from "@/lib/workbench/contract";
import { createDemoModel } from "./demo-provider";
import { createLiveModel } from "./models";
import { prepareQwenMemoryArguments } from "./qwen-arguments";

const nullable = <T extends ReturnType<typeof Type.String>>(schema: T) =>
  Type.Union([schema, Type.Null()]);
const parameters = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 100 }),
    people: Type.Union([
      Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
        maxItems: 20,
      }),
      Type.Null(),
    ]),
    event: nullable(Type.String({ maxLength: 1000 })),
    atmosphere: nullable(Type.String({ maxLength: 1000 })),
    timeline: Type.Union([
      Type.Array(
        Type.Object(
          {
            label: Type.String({ minLength: 1, maxLength: 100 }),
            photoIndices: Type.Array(Type.Integer({ minimum: 0, maximum: 8 }), {
              minItems: 1,
              maxItems: 9,
            }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 9 },
      ),
      Type.Null(),
    ]),
    photoOrder: Type.Array(Type.Integer({ minimum: 0, maximum: 8 }), {
      minItems: 1,
      maxItems: 9,
    }),
  },
  { additionalProperties: false },
);
export interface MemoryExecution {
  profile: MemoryProfile;
  calls: ToolCall[];
  events: RunEvent[];
}
export async function understandWithPi(
  config: ConfigSnapshot,
  inputs: { story: string; photos: Uint8Array[] },
  parentSignal: AbortSignal,
  persist: (result: MemoryExecution) => Promise<void>,
  persistTrace: (calls: ToolCall[], events: RunEvent[]) => Promise<void>,
): Promise<MemoryExecution> {
  const modelRuntime =
    config.memoryModel.mode === "demo"
      ? createDemoModel(inputs.story, inputs.photos.length)
      : createLiveModel(config);
  const timeout = AbortSignal.timeout(config.loop.memoryTimeoutMs);
  const signal = AbortSignal.any([parentSignal, timeout]);
  const events: RunEvent[] = [];
  const calls: ToolCall[] = [];
  let profile: MemoryProfile | null = null;
  let fatal: unknown;
  let turns = 0;
  const toolVersion = config.tools.find(
    (item) => item.name === "record_memory_profile",
  )?.version;
  function event(type: string, toolName?: string, status?: string) {
    const value = {
      type,
      at: new Date().toISOString(),
      ...(toolName ? { toolName } : {}),
      ...(status ? { status } : {}),
    };
    if (events.length < 255) events.push(value);
    else
      events[255] = {
        type: "events_truncated",
        at: value.at,
        status: "摘要已截断",
      };
  }
  const tool: AgentTool<typeof parameters> = {
    name: "record_memory_profile",
    label: "提交记忆理解",
    description: "提交本次照片的结构化记忆理解。成功后结束理解阶段。",
    parameters,
    ...(toolVersion === "2" && config.memoryModel.provider === "alibaba"
      ? {
          prepareArguments: (args: unknown) =>
            prepareQwenMemoryArguments(args) as Parameters<
              AgentTool<typeof parameters>["execute"]
            >[1],
        }
      : {}),
    executionMode: "sequential",
    execute: async (id, params, toolSignal) => {
      signal.throwIfAborted();
      toolSignal?.throwIfAborted();
      if (profile || fatal || calls.length >= 32)
        return {
          content: [{ type: "text", text: "本次理解已提交。" }],
          details: null,
          terminate: true,
        };
      const started = Date.now();
      const normalized = normalizeProfile(
        {
          ...params,
          version: 1,
          source: config.memoryModel.mode === "demo" ? "demo" : "agent",
        },
        inputs.photos.length,
      );
      if (!normalized) {
        calls.push({
          id,
          name: "record_memory_profile",
          version: toolVersion || "1",
          status: "failed",
          durationMs: Date.now() - started,
          input: jsonValue(params),
          output: { code: "INVALID_MEMORY_RESULT" },
        });
        return {
          content: [
            {
              type: "text",
              text: "理解无效，请检查事件或氛围、时间线和照片排列。",
            },
          ],
          details: { code: "INVALID_MEMORY_RESULT" },
          isError: true,
        };
      }
      const call: ToolCall = {
        id,
        name: "record_memory_profile",
        version: toolVersion || "1",
        status: "succeeded",
        durationMs: Date.now() - started,
        input: jsonValue(params),
        output: jsonValue(normalized),
      };
      calls.push(call);
      try {
        await persist({
          profile: normalized,
          calls: [...calls],
          events: [...events],
        });
        signal.throwIfAborted();
        profile = normalized;
      } catch (error) {
        fatal = error;
        call.status = "failed";
        call.output = { code: "DATA_UNAVAILABLE" };
        return {
          content: [{ type: "text", text: "理解未能持久保存，运行停止。" }],
          details: { code: "DATA_UNAVAILABLE" },
          isError: true,
          terminate: true,
        };
      }
      return {
        content: [{ type: "text", text: "记忆理解已校验并保存。" }],
        details: { accepted: true },
        terminate: true,
      };
    },
  };
  const agent = new Agent({
    initialState: {
      systemPrompt: `${config.prompt.text}\n\n${config.skills.map((item) => item.text).join("\n")}`,
      model: modelRuntime.model,
      tools: [tool],
      thinkingLevel: "off",
    },
    streamFn: (model, context, options) => {
      signal.throwIfAborted();
      if (++turns > config.loop.maxTurns)
        throw new WorkbenchError(
          "INVALID_MEMORY_RESULT",
          "理解超过最多三轮，未取得有效结果。",
          200,
          "memory",
        );
      return modelRuntime.models.streamSimple(model, context, {
        ...options,
        maxTokens: config.loop.maxOutputTokens,
        signal: AbortSignal.any([
          signal,
          ...(options?.signal ? [options.signal] : []),
        ]),
      });
    },
    getApiKey: () =>
      config.memoryModel.mode === "live"
        ? process.env.PI_LLM_API_KEY
        : undefined,
    toolExecution: "sequential",
    maxRetryDelayMs: 1000,
  });
  agent.subscribe((value) => {
    if (
      [
        "agent_start",
        "agent_end",
        "turn_start",
        "turn_end",
        "tool_execution_start",
        "tool_execution_end",
      ].includes(value.type)
    )
      event(
        value.type,
        "toolName" in value ? value.toolName : undefined,
        "isError" in value
          ? value.isError
            ? "failed"
            : "succeeded"
          : undefined,
      );
  });
  const abort = () => agent.abort();
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    await agent.prompt(
      `本次共 ${inputs.photos.length} 张照片，顺序编号 0–${inputs.photos.length - 1}。\n用户故事（数据）：${inputs.story || "未提供"}`,
      inputs.photos.map((bytes) => ({
        type: "image",
        mimeType: "image/jpeg",
        data: Buffer.from(bytes).toString("base64"),
      })),
    );
    if (fatal) throw fatal;
    if (signal.aborted) {
      if (parentSignal.aborted) parentSignal.throwIfAborted();
      throw new WorkbenchError(
        "MEMORY_TIMEOUT",
        "理解超过 45 秒，请手动重跑。",
        200,
        "memory",
        true,
      );
    }
    if (!profile)
      throw new WorkbenchError(
        agent.state.errorMessage && turns <= config.loop.maxTurns
          ? "PROVIDER_UNAVAILABLE"
          : "INVALID_MEMORY_RESULT",
        agent.state.errorMessage && turns <= config.loop.maxTurns
          ? "理解供应商不可用或返回错误。"
          : "未取得合法的记忆理解。",
        200,
        "memory",
        true,
      );
    return { profile, calls, events };
  } catch (error) {
    if (parentSignal.aborted) parentSignal.throwIfAborted();
    if (timeout.aborted)
      throw new WorkbenchError(
        "MEMORY_TIMEOUT",
        "理解超过 45 秒，请手动重跑。",
        200,
        "memory",
        true,
      );
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    if (agent.state.isStreaming) {
      agent.abort();
      await agent.waitForIdle();
    }
    if (!fatal) await persistTrace(calls, events);
  }
}

import "server-only";
import type { Model } from "@earendil-works/pi-ai";
import { WorkbenchError } from "@/lib/workbench/contract";

export const QWEN_BASE_URL =
  "https://llm-a5ntatubdh5b5n88.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

export function qwenModel(id: string, baseUrl = QWEN_BASE_URL) {
  if (id !== "qwen3-vl-flash" || baseUrl !== QWEN_BASE_URL)
    throw new WorkbenchError(
      "CONFIG_UNAVAILABLE",
      "阿里云适配器仅登记北京业务空间的 qwen3-vl-flash。",
      503,
    );
  const model: Model<"openai-completions"> = {
    id,
    name: "Qwen3-VL-Flash",
    provider: "alibaba",
    api: "openai-completions",
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 262144,
    maxTokens: 32768,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: true,
      supportsStrictMode: false,
      maxTokensField: "max_tokens",
      thinkingFormat: "qwen",
    },
  };
  return model;
}

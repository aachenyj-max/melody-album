import "server-only";
import {
  createModels,
  createProvider,
  envApiKeyAuth,
  type Model,
  type ProviderStreams,
} from "@earendil-works/pi-ai";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import * as completions from "@earendil-works/pi-ai/api/openai-completions";
import * as responses from "@earendil-works/pi-ai/api/openai-responses";
import * as anthropic from "@earendil-works/pi-ai/api/anthropic-messages";
import { WorkbenchError, type ConfigSnapshot } from "@/lib/workbench/contract";
import { qwenModel } from "./qwen";

const factories = { openai: openaiProvider, anthropic: anthropicProvider };
const protocols: Record<string, ProviderStreams> = {
  "openai-completions": completions,
  "openai-responses": responses,
  "anthropic-messages": anthropic,
};
function unavailable(message: string): never {
  throw new WorkbenchError("CONFIG_UNAVAILABLE", message, 503);
}
export function liveDescriptor() {
  const providerId = process.env.PI_LLM_PROVIDER?.trim();
  const id = process.env.PI_LLM_MODEL?.trim();
  if (!providerId || !id || !process.env.PI_LLM_API_KEY?.trim())
    unavailable("真实理解需要供应商、模型和匹配的服务端凭证。");
  if (!(providerId in factories) && providerId !== "alibaba")
    unavailable("供应商尚未登记为可执行版本。");
  const model =
    providerId === "alibaba"
      ? qwenModel(id, process.env.PI_LLM_BASE_URL?.trim() || undefined)
      : factories[providerId as keyof typeof factories]()
          .getModels()
          .find((item) => item.id === id);
  if (!model?.input.includes("image") || model.maxTokens < 2048)
    unavailable("模型未登记或不具备所需的图片输入与输出能力。");
  const api = process.env.PI_LLM_API?.trim() || model.api;
  if (!protocols[api]) unavailable("模型协议尚未支持。");
  if (providerId === "anthropic" && api !== "anthropic-messages")
    unavailable("模型与协议不匹配。");
  if (providerId === "openai" && !api.startsWith("openai-"))
    unavailable("模型与协议不匹配。");
  if (providerId === "alibaba" && api !== "openai-completions")
    unavailable("阿里云视觉模型需要 OpenAI Chat Completions 协议。");
  const baseUrl = process.env.PI_LLM_BASE_URL?.trim() || model.baseUrl;
  try {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      unavailable("供应商地址必须是无凭证的 HTTPS 地址。");
  } catch {
    unavailable("供应商地址配置无效。");
  }
  return {
    mode: "live" as const,
    provider: providerId,
    api,
    modelDescriptor: {
      id,
      input: [...model.input],
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      baseUrl,
    },
  };
}
export function createLiveModel(config: ConfigSnapshot) {
  const expected = liveDescriptor();
  if (
    config.memoryModel.provider !== expected.provider ||
    config.memoryModel.api !== expected.api ||
    config.memoryModel.modelDescriptor.id !== expected.modelDescriptor.id ||
    config.memoryModel.modelDescriptor.baseUrl !==
      expected.modelDescriptor.baseUrl ||
    config.memoryModel.modelDescriptor.contextWindow !==
      expected.modelDescriptor.contextWindow ||
    config.memoryModel.modelDescriptor.maxTokens !==
      expected.modelDescriptor.maxTokens ||
    !config.memoryModel.modelDescriptor.input.includes("image")
  )
    unavailable("当前凭证映射无法执行该历史模型配置。");
  const { provider, api, modelDescriptor: descriptor } = config.memoryModel;
  const model: Model<string> =
    provider === "alibaba"
      ? qwenModel(descriptor.id, descriptor.baseUrl)
      : {
          id: descriptor.id,
          name: descriptor.id,
          provider,
          api,
          baseUrl: descriptor.baseUrl,
          reasoning: false,
          input: descriptor.input,
          contextWindow: descriptor.contextWindow,
          maxTokens: descriptor.maxTokens,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        };
  const models = createModels();
  models.setProvider(
    createProvider({
      id: provider,
      baseUrl: descriptor.baseUrl,
      models: [model],
      auth: {
        apiKey: envApiKeyAuth("Workbench model key", ["PI_LLM_API_KEY"]),
      },
      api: protocols[api],
    }),
  );
  const registered = models.getModel(provider, descriptor.id);
  if (!registered?.input.includes("image")) unavailable("图片模型不可执行。");
  return { models, model: registered };
}

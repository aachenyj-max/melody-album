import "server-only";
import { randomUUID } from "node:crypto";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai";

export function createDemoModel(story: string, photoCount: number) {
  const faux = fauxProvider({
    provider: `workbench-demo-${randomUUID()}`,
    models: [
      {
        id: "memory-demo-v1",
        input: ["text", "image"],
        contextWindow: 16384,
        maxTokens: 2048,
      },
    ],
    tokensPerSecond: 10000,
  });
  faux.setResponses([
    fauxAssistantMessage(
      [
        fauxToolCall("record_memory_profile", {
          title: story
            ? `${story.slice(0, 24)} · 演示理解`
            : "一起走过的时光 · 演示理解",
          people: null,
          event: story || "一组共同回忆的照片（演示）",
          atmosphere: "温暖、平静的回忆（演示规则）",
          timeline: null,
          photoOrder: Array.from({ length: photoCount }, (_, index) => index),
        }),
      ],
      { stopReason: "toolUse" },
    ),
  ]);
  const models = createModels();
  models.setProvider(faux.provider);
  return { models, model: faux.getModel() };
}

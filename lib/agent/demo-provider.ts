import "server-only";
import { randomUUID } from "node:crypto";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { MemoryProfile } from "@/lib/memory/contract";
import { WorkbenchError } from "@/lib/workbench/contract";

export function createDemoModel(
  story: string,
  photoCount: number,
  revision?: { profile: MemoryProfile; instruction: string },
) {
  const result = revision
    ? reviseDemoProfile(revision.profile, revision.instruction)
    : {
        title: story
          ? `${story.slice(0, 24)} · 演示理解`
          : "一起走过的时光 · 演示理解",
        people: null,
        event: story ? story.slice(0, 1000) : "一组共同回忆的照片（演示）",
        atmosphere: "温暖、平静的回忆（演示规则）",
        timeline: null,
        photoOrder: Array.from({ length: photoCount }, (_, index) => index),
      };
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
    fauxAssistantMessage([fauxToolCall("record_memory_profile", result)], {
      stopReason: "toolUse",
    }),
  ]);
  const models = createModels();
  models.setProvider(faux.provider);
  return { models, model: faux.getModel() };
}

function reviseDemoProfile(profile: MemoryProfile, instruction: string) {
  const {
    version: _version,
    source: _source,
    ...result
  } = structuredClone(profile);
  if (/标题|名字|叫做|改成/.test(instruction)) {
    result.title =
      instruction
        .replace(/^(把|将)?(标题|名字)(改成|改为|叫做)?/, "")
        .trim()
        .slice(0, 100) || profile.title;
  } else if (/毕业|旅行|生日|婚礼|事件|不是/.test(instruction)) {
    result.event = instruction.slice(0, 1000);
  } else if (/快乐|开心|轻快|伤感|安静|温暖|热闹|氛围|不舍/.test(instruction)) {
    result.atmosphere = instruction.slice(0, 1000);
  } else if (/朋友|家人|人物/.test(instruction)) {
    result.people = [instruction.slice(0, 100)];
  } else if (/时间线|顺序|先.*后/.test(instruction)) {
    result.timeline = [
      {
        label: instruction.slice(0, 100),
        photoIndices: [...profile.photoOrder],
      },
    ];
  } else {
    throw new WorkbenchError(
      "REVISION_UNCLEAR",
      "没有理解这次修正，请换一种说法。",
      422,
    );
  }
  return result;
}

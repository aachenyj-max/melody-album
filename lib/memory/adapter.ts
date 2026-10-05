import type { MemoryProfile } from "./contract";
import { MemoryRequestError } from "./request";

type Scenario =
  | "success"
  | "partial"
  | "invalid-result"
  | "timeout"
  | "unavailable"
  | "revision-unclear";
const scenarios = new Set<Scenario>([
  "success",
  "partial",
  "invalid-result",
  "timeout",
  "unavailable",
  "revision-unclear",
]);

function scenarioFor(request: Request): Scenario {
  const value = request.headers.get("X-Demo-Scenario") as Scenario | null;
  return process.env.NODE_ENV === "development" && value && scenarios.has(value)
    ? value
    : "success";
}

function demoUnderstand(
  count: number,
  story: string,
  scenario: Scenario,
): MemoryProfile {
  if (scenario === "timeout") throw new MemoryRequestError("AGENT_TIMEOUT");
  if (scenario === "unavailable")
    throw new MemoryRequestError("AGENT_UNAVAILABLE");
  if (scenario === "invalid-result")
    throw new MemoryRequestError("INVALID_RESULT");
  const event = story ? story.slice(0, 90) : "这组照片记录的一段回忆";
  return {
    version: 1,
    title: story ? story.slice(0, 18) : "我的音乐记忆",
    people: null,
    event,
    atmosphere: scenario === "partial" ? null : "温暖、值得珍藏",
    timeline: null,
    photoOrder: Array.from({ length: count }, (_, i) => i),
    source: "demo",
  };
}

function demoRevise(
  profile: MemoryProfile,
  instruction: string,
  scenario: Scenario,
): MemoryProfile {
  if (scenario === "timeout") throw new MemoryRequestError("AGENT_TIMEOUT");
  if (scenario === "unavailable")
    throw new MemoryRequestError("AGENT_UNAVAILABLE");
  if (scenario === "revision-unclear")
    throw new MemoryRequestError("REVISION_UNCLEAR");
  const next = { ...profile, version: profile.version + 1 };
  if (/标题|名字|叫做|改成/.test(instruction)) {
    next.title =
      instruction
        .replace(/^(把|将)?(标题|名字)(改成|改为|叫做)?/, "")
        .trim()
        .slice(0, 40) || profile.title;
  } else if (/毕业|旅行|生日|婚礼|事件|不是/.test(instruction)) {
    next.event = instruction.slice(0, 90);
  } else if (/快乐|开心|轻快|伤感|安静|温暖|热闹|氛围|不舍/.test(instruction)) {
    next.atmosphere = instruction.slice(0, 90);
  } else if (/朋友|家人|人物/.test(instruction)) {
    next.people = [instruction.slice(0, 50)];
  } else if (/时间线|顺序|先.*后/.test(instruction)) {
    next.timeline = [
      {
        label: instruction.slice(0, 90),
        photoIndices: [...profile.photoOrder],
      },
    ];
  } else {
    throw new MemoryRequestError("REVISION_UNCLEAR");
  }
  return next;
}

function realAgentConfigured(): boolean {
  return Boolean(process.env.PI_AGENT_URL || process.env.PI_AGENT_API_KEY);
}

function unavailableRealAdapter(): never {
  // The provider's actual endpoint shape and authentication contract are not available yet.
  throw new MemoryRequestError("AGENT_UNAVAILABLE");
}

export async function understandMemory(
  request: Request,
  photos: File[],
  story: string,
): Promise<MemoryProfile> {
  if (realAgentConfigured()) unavailableRealAdapter();
  return demoUnderstand(photos.length, story, scenarioFor(request));
}

export async function reviseMemory(
  request: Request,
  _photos: File[],
  _story: string,
  profile: MemoryProfile,
  instruction: string,
): Promise<MemoryProfile> {
  const scenario = scenarioFor(request);
  if (realAgentConfigured()) unavailableRealAdapter();
  const result = demoRevise(profile, instruction, scenario);
  if (result.version !== profile.version + 1)
    throw new MemoryRequestError("INVALID_RESULT");
  return result;
}

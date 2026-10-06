import { NextResponse } from "next/server";
import { generateMusic } from "@/lib/music/generator";
import { getMockRecommendations } from "@/lib/music/mock-recommendations";
import {
  normalizeAdjustmentInstruction,
  validateMusicProfile,
  type MusicProfile,
} from "@/lib/music/contract";

export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };

function failure(
  requestId: string,
  code: string,
  message: string,
  status: number,
  retryable = true,
) {
  return NextResponse.json(
    { contractVersion: 1, requestId, error: { code, message, retryable } },
    { status, headers },
  );
}

function adjustedProfile(
  profile: MusicProfile,
  instruction: string,
): MusicProfile {
  const lower = instruction.toLowerCase();
  const tempo = /快|活泼|快乐|青春|bright|upbeat/.test(lower)
    ? "lively"
    : /慢|安静|轻柔|舒缓|quiet|soft/.test(lower)
      ? "slow"
      : profile.tempo;
  const mood = /快乐|开心|青春/.test(lower)
    ? "明亮、快乐、充满青春感"
    : /安静|轻柔|舒缓/.test(lower)
      ? "安静、温柔、舒缓"
      : profile.mood;
  const prompt = `${profile.instrumentalPrompt.slice(0, 260)}。在此前记忆音乐的基础上调整：${instruction.slice(0, 280)}。保持无歌词、无人声。`;
  return { ...profile, mood, tempo, instrumentalPrompt: prompt.slice(0, 600) };
}

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return failure(
      "unknown",
      "INVALID_CONTEXT",
      "调整请求无效，请返回播放页重试。",
      400,
      false,
    );
  }
  const requestId =
    typeof raw?.requestId === "string" && /^[\w-]{1,100}$/.test(raw.requestId)
      ? raw.requestId
      : "unknown";
  const profile = validateMusicProfile(raw?.profile);
  const instruction = normalizeAdjustmentInstruction(raw?.instruction);
  if (
    raw?.contractVersion !== 1 ||
    !profile ||
    requestId === "unknown" ||
    (raw?.path !== "ai" && raw?.path !== "qq") ||
    typeof raw?.baseTrackId !== "string" ||
    !raw.baseTrackId.trim()
  )
    return failure(
      requestId,
      "INVALID_CONTEXT",
      "当前记忆或音乐版本已失效，请返回结果页。",
      400,
      false,
    );
  if (!instruction)
    return failure(
      requestId,
      "INVALID_INSTRUCTION",
      "请输入 1–300 字的调整要求。",
      400,
      false,
    );
  const nextProfile = adjustedProfile(profile, instruction);
  if (raw.path === "qq") {
    const alternatives = getMockRecommendations(nextProfile).filter(
      (item) => item.id !== raw.baseTrackId,
    );
    const preferred = /吉他/.test(instruction)
      ? alternatives.find((item) => item.id === "mock-sunlit-steps")
      : /安静|慢/.test(instruction)
        ? alternatives.find((item) => item.id === "mock-night-window")
        : alternatives[0];
    const track = preferred
      ? {
          ...preferred,
          audioUrl: "/audio/music-album/mock-qq.wav",
          playable: true,
        }
      : null;
    if (!track)
      return failure(
        requestId,
        "NO_PLAYABLE_RESULT",
        "当前没有另一首可试听的演示推荐，原歌曲仍可播放。",
        422,
      );
    return NextResponse.json(
      {
        contractVersion: 1,
        requestId,
        source: "mock",
        track,
        responseText: "已按你的想法重新匹配一首演示推荐。",
      },
      { headers },
    );
  }
  const result = await generateMusic(nextProfile);
  if (!result.ok) {
    const code =
      result.error.code === "INVALID_GENERATED_AUDIO"
        ? "NO_PLAYABLE_RESULT"
        : result.error.code;
    const status =
      code === "GENERATION_TIMEOUT"
        ? 504
        : code === "GENERATION_UNAVAILABLE"
          ? 503
          : 502;
    return failure(
      requestId,
      code,
      result.error.message,
      status,
      result.error.retryable,
    );
  }
  return NextResponse.json(
    {
      contractVersion: 1,
      requestId,
      source: result.source,
      track: result.track,
      responseText: `已经根据“${instruction}”调整音乐，可以重新试听。`,
    },
    { headers },
  );
}

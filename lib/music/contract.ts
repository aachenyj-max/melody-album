import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";

export const MUSIC_CONTRACT_VERSION = 1 as const;
export const MUSIC_DURATION_MIN = 15;
export const MUSIC_DURATION_MAX = 30;

export type Tempo = "slow" | "moderate" | "lively";
export type Structure = "gentle" | "steady" | "uplifting";

export type MusicProfile = {
  contractVersion: 1;
  memoryVersion: number;
  memoryTitle: string;
  mood: string;
  style: string;
  tempo: Tempo;
  structure: Structure;
  instrumentalPrompt: string;
  targetDurationSec: number;
};

export type PlayableAudio = {
  title: string;
  durationSec: number;
  audioUrl: string;
  audioMimeType: string;
  source: "api" | "demo" | "mock" | "ambient";
  expiresAt?: string | null;
};

export type MusicErrorCode =
  | "INVALID_PROFILE"
  | "GENERATION_UNAVAILABLE"
  | "GENERATION_TIMEOUT"
  | "INVALID_GENERATED_AUDIO"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export type MusicError = {
  code: MusicErrorCode;
  message: string;
  retryable: boolean;
};

export type AiTrack = Omit<PlayableAudio, "source"> & {
  source: "api" | "demo";
};

export type MockRecommendation = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number;
  reason: string;
  source: "mock";
  audioUrl: string | null;
  playable: boolean;
};

export type MusicSelection = { kind: "ai" } | { kind: "qq"; trackId: string };

export type AiBranch = {
  status: "idle" | "pending" | "ready" | "failed";
  attemptId: string | null;
  source: "api" | "demo" | null;
  progressPercent: number | null;
  track: AiTrack | null;
  error: MusicError | null;
};

export type RecommendationBranch = {
  status: "idle" | "pending" | "ready" | "empty" | "failed";
  attemptId: string | null;
  tracks: MockRecommendation[];
  error: MusicError | null;
};

export type MusicRun = {
  runId: string;
  creationEpoch: number;
  profile: MusicProfile;
  ai: AiBranch;
  recommendations: RecommendationBranch;
  selection: MusicSelection;
  ambientTrack: PlayableAudio | null;
  currentVersionId?: string | null;
  adjustedTrack?: (AiTrack & { versionId: string; explanation: string }) | null;
};

export type AdjustmentRun = {
  id: string;
  instruction: string;
  baseTrackId: string;
  path: "ai" | "qq";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  responseText: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
};

export function normalizeAdjustmentInstruction(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const instruction = value.trim();
  return instruction.length >= 1 && instruction.length <= 300
    ? instruction
    : null;
}

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function validateMusicProfile(value: unknown): MusicProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const allowed = new Set([
    "contractVersion",
    "memoryVersion",
    "memoryTitle",
    "mood",
    "style",
    "tempo",
    "structure",
    "instrumentalPrompt",
    "targetDurationSec",
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) return null;
  const text = (key: string, max: number) =>
    nonempty(raw[key]) && raw[key].trim().length <= max;
  if (
    raw.contractVersion !== MUSIC_CONTRACT_VERSION ||
    !Number.isSafeInteger(raw.memoryVersion) ||
    !text("memoryTitle", 100) ||
    !text("mood", 100) ||
    !text("style", 100) ||
    !text("instrumentalPrompt", 600) ||
    String(raw.instrumentalPrompt).trim().length < 10 ||
    !["slow", "moderate", "lively"].includes(String(raw.tempo)) ||
    !["gentle", "steady", "uplifting"].includes(String(raw.structure)) ||
    !Number.isInteger(raw.targetDurationSec) ||
    Number(raw.targetDurationSec) < MUSIC_DURATION_MIN ||
    Number(raw.targetDurationSec) > MUSIC_DURATION_MAX ||
    !String(raw.instrumentalPrompt).includes("无歌词") ||
    !String(raw.instrumentalPrompt).includes("无人声")
  )
    return null;
  return {
    contractVersion: 1,
    memoryVersion: Number(raw.memoryVersion),
    memoryTitle: String(raw.memoryTitle).trim(),
    mood: String(raw.mood).trim(),
    style: String(raw.style).trim(),
    tempo: raw.tempo as Tempo,
    structure: raw.structure as Structure,
    instrumentalPrompt: String(raw.instrumentalPrompt).trim(),
    targetDurationSec: Number(raw.targetDurationSec),
  };
}

export function musicError(code: MusicErrorCode): MusicError {
  const details: Record<MusicErrorCode, Omit<MusicError, "code">> = {
    INVALID_PROFILE: {
      message: "当前音乐意图已失效，请重新确认记忆。",
      retryable: false,
    },
    GENERATION_UNAVAILABLE: {
      message: "配乐服务暂不可用，请重试。",
      retryable: true,
    },
    GENERATION_TIMEOUT: {
      message: "配乐生成用时较长，请重试。",
      retryable: true,
    },
    INVALID_GENERATED_AUDIO: {
      message: "生成结果暂时无法播放，请重试。",
      retryable: true,
    },
    PROVIDER_ERROR: {
      message: "配乐服务返回了错误，请重试。",
      retryable: true,
    },
    UNKNOWN: { message: "暂时无法生成配乐，请重试。", retryable: true },
  };
  return { code, ...details[code] };
}

export type ConfirmedMusicInput = {
  profile: MemoryProfile;
  photos: File[];
};

export function isConfirmedMusicInput(
  value: unknown,
): value is ConfirmedMusicInput {
  if (!value || typeof value !== "object") return false;
  const raw = value as { profile?: MemoryProfile; photos?: unknown };
  const profile = raw.profile;
  return Boolean(
    Array.isArray(raw.photos) &&
      raw.photos.length >= 1 &&
      raw.photos.length <= 9 &&
      raw.photos.every(
        (photo) => typeof File === "undefined" || photo instanceof File,
      ) &&
      normalizeProfile(profile, raw.photos.length) !== null,
  );
}

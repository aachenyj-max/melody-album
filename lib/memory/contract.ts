export const CONTRACT_VERSION = 1 as const;
export const MAX_PHOTOS = 9;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_REQUEST_BYTES = Math.floor(3.5 * 1024 * 1024);

export type CreationPhase =
  | "idle"
  | "selected"
  | "understanding"
  | "ready"
  | "revising"
  | "invalid"
  | "failed"
  | "confirmed";

export type TimelineItem = { label: string; photoIndices: number[] };
export type MemoryProfile = {
  version: number;
  title: string;
  people: string[] | null;
  event: string | null;
  atmosphere: string | null;
  timeline: TimelineItem[] | null;
  photoOrder: number[];
  source: "agent" | "demo";
};
export type MemoryErrorCode =
  | "INVALID_PHOTO_COUNT"
  | "UNSUPPORTED_FILE"
  | "PHOTO_TOO_LARGE"
  | "REQUEST_TOO_LARGE"
  | "PHOTO_READ_FAILED"
  | "INVALID_STORY"
  | "INVALID_PROFILE"
  | "INVALID_INSTRUCTION"
  | "REVISION_UNCLEAR"
  | "INVALID_RESULT"
  | "AGENT_UNAVAILABLE"
  | "AGENT_TIMEOUT"
  | "UNKNOWN";
export type MemoryFailure = {
  contractVersion: 1;
  requestId: string;
  error: { code: MemoryErrorCode; message: string; retryable: boolean };
};
export type MemorySuccess = {
  contractVersion: 1;
  requestId: string;
  profile: MemoryProfile;
  agent?: { promptVersion: string; mode: "demo" | "live"; digest: string };
};

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function normalizeProfile(
  value: unknown,
  photoCount: number,
): MemoryProfile | null {
  if (
    !value ||
    typeof value !== "object" ||
    photoCount < 1 ||
    photoCount > MAX_PHOTOS
  )
    return null;
  const raw = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(raw.version) ||
    Number(raw.version) < 1 ||
    !nonempty(raw.title)
  )
    return null;
  if (raw.source !== "agent" && raw.source !== "demo") return null;
  const optional = (input: unknown): string | null | undefined =>
    input === null || input === ""
      ? null
      : nonempty(input)
        ? input.trim()
        : undefined;
  const event = optional(raw.event);
  const atmosphere = optional(raw.atmosphere);
  if (
    event === undefined ||
    atmosphere === undefined ||
    (!event && !atmosphere)
  )
    return null;
  const people =
    raw.people === null ||
    (Array.isArray(raw.people) && raw.people.length === 0)
      ? null
      : Array.isArray(raw.people) && raw.people.every(nonempty)
        ? raw.people.map((item: string) => item.trim())
        : undefined;
  if (people === undefined) return null;
  const order = raw.photoOrder;
  if (
    !Array.isArray(order) ||
    order.length !== photoCount ||
    new Set(order).size !== photoCount ||
    !order.every(
      (item) => Number.isInteger(item) && item >= 0 && item < photoCount,
    )
  )
    return null;
  let timeline: TimelineItem[] | null = null;
  if (
    raw.timeline !== null &&
    !(Array.isArray(raw.timeline) && raw.timeline.length === 0)
  ) {
    if (
      !Array.isArray(raw.timeline) ||
      !raw.timeline.every(
        (item) =>
          item &&
          typeof item === "object" &&
          nonempty(item.label) &&
          Array.isArray(item.photoIndices) &&
          item.photoIndices.length > 0 &&
          item.photoIndices.every(
            (index: unknown) =>
              Number.isInteger(index) &&
              Number(index) >= 0 &&
              Number(index) < photoCount,
          ),
      )
    )
      return null;
    timeline = raw.timeline.map((item: TimelineItem) => ({
      label: item.label.trim(),
      photoIndices: [...item.photoIndices],
    }));
  }
  return {
    version: Number(raw.version),
    title: raw.title.trim(),
    people,
    event,
    atmosphere,
    timeline,
    photoOrder: [...order],
    source: raw.source,
  };
}

const errorDetails: Record<
  MemoryErrorCode,
  { status: number; message: string; retryable: boolean }
> = {
  INVALID_PHOTO_COUNT: {
    status: 400,
    message: "请选择 1–9 张照片。",
    retryable: false,
  },
  UNSUPPORTED_FILE: {
    status: 400,
    message: "仅支持 JPEG、PNG 或 WebP 照片。",
    retryable: false,
  },
  PHOTO_TOO_LARGE: {
    status: 413,
    message: "照片超过大小限制，请移除或更换。",
    retryable: false,
  },
  REQUEST_TOO_LARGE: {
    status: 413,
    message: "照片数据过大，请移除或更换照片后重试。",
    retryable: false,
  },
  PHOTO_READ_FAILED: {
    status: 422,
    message: "照片无法读取，请移除或更换。",
    retryable: false,
  },
  INVALID_STORY: {
    status: 400,
    message: "故事最多 1000 字。",
    retryable: false,
  },
  INVALID_PROFILE: {
    status: 400,
    message: "当前理解结果已失效，请重新理解。",
    retryable: false,
  },
  INVALID_INSTRUCTION: {
    status: 400,
    message: "请输入 1–300 字的修正内容。",
    retryable: false,
  },
  REVISION_UNCLEAR: {
    status: 422,
    message: "没有理解这次修正，请换一种说法。",
    retryable: true,
  },
  INVALID_RESULT: {
    status: 502,
    message: "这次未得到可确认的理解，请重试或补充故事。",
    retryable: true,
  },
  AGENT_UNAVAILABLE: {
    status: 503,
    message: "理解服务暂不可用，请稍后重试。",
    retryable: true,
  },
  AGENT_TIMEOUT: {
    status: 504,
    message: "理解照片用时较长，请重试。",
    retryable: true,
  },
  UNKNOWN: { status: 500, message: "暂时无法处理，请重试。", retryable: true },
};

export function failure(
  code: MemoryErrorCode,
  requestId: string,
): { body: MemoryFailure; status: number } {
  const detail = errorDetails[code];
  return {
    status: detail.status,
    body: {
      contractVersion: CONTRACT_VERSION,
      requestId,
      error: { code, message: detail.message, retryable: detail.retryable },
    },
  };
}

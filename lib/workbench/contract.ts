export const WORKBENCH_VERSION = 1 as const;
export const STAGES = [
  "input",
  "memory",
  "music_profile",
  "ai_music",
  "qq_recommendations",
  "summary",
] as const;
export const RUN_STATUSES = [
  "uploading",
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "interrupted",
] as const;
export type Stage = (typeof STAGES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type StepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "interrupted";
export type Source =
  | "agent"
  | "demo"
  | "api"
  | "mock"
  | "deterministic"
  | "none";
export type Driver = "pi" | "pipeline";
export type AssetState = "reserved" | "ready" | "failed" | "delete_pending";
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export interface WorkbenchErrorData {
  code: string;
  message: string;
  retryable: boolean;
  stage: Stage | null;
}
export class WorkbenchError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public stage: Stage | null = null,
    public retryable = false,
    public runId?: string,
  ) {
    super(message);
  }
}
export interface ConfigSnapshot {
  schemaVersion: 1;
  engine: { name: "pi"; packages: { agentCore: "1.0.3"; ai: "1.0.3" } };
  prompt: { version: string; text: string; sha256: string };
  loop: {
    version: string;
    maxTurns: 3;
    maxOutputTokens: 2048;
    memoryTimeoutMs: 45000;
  };
  skills: { name: string; version: string; text: string; sha256: string }[];
  tools: {
    name: string;
    version: string;
    driver: Driver;
    contractVersion: number;
  }[];
  memoryModel: {
    mode: "demo" | "live";
    provider: string;
    api: string;
    modelDescriptor: {
      id: string;
      input: ("text" | "image")[];
      contextWindow: number;
      maxTokens: number;
      baseUrl: string;
    };
  };
  music: { mode: "demo" | "live"; adapterVersion: string; modelId: string };
  recommendation: { mode: "mock"; datasetVersion: string };
  contractVersions: { memory: 1; music: 1 };
  runTimeoutMs: 210000;
}
export interface InputSnapshot {
  contractVersion: 1;
  story: string;
  photoCount: number;
  photoOrder: number[];
  photos: { position: number; sha256: string; byteSize: number }[];
}
export interface ToolCall {
  name: string;
  version: string;
  id: string;
  status: "succeeded" | "failed";
  durationMs: number;
  input: Json;
  output: Json;
}
export interface RunEvent {
  type: string;
  at: string;
  toolName?: string;
  status?: string;
}
export interface StepDetail {
  stage: Stage;
  status: StepStatus;
  driver: Driver;
  source: Source;
  startedAt: string | null;
  endedAt: string | null;
  result: Json;
  calls: ToolCall[];
  events: RunEvent[];
  error: WorkbenchErrorData | null;
}
export interface RunDetail {
  runId: string;
  parentRunId: string | null;
  kind: "internal_test";
  status: RunStatus;
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  endedAt: string | null;
  inputSnapshot: InputSnapshot;
  photos: { position: number; previewUrl: string }[];
  configSnapshot: ConfigSnapshot;
  configDigest: string;
  steps: StepDetail[];
  summary: Json;
  error: WorkbenchErrorData | null;
}
export type RunListItem = Pick<
  RunDetail,
  | "runId"
  | "parentRunId"
  | "kind"
  | "status"
  | "createdAt"
  | "expiresAt"
  | "configDigest"
> & {
  inputSummary: { photoCount: number; hasStory: boolean };
  versions: { prompt: string; loop: string };
  sources: { memory: string; music: string; recommendation: "mock" };
};
export type DiffState =
  | "equal"
  | "changed"
  | "missing_left"
  | "missing_right"
  | "pending";
export interface DiffEntry {
  path: string;
  left: Json | undefined;
  right: Json | undefined;
  state: DiffState;
}
export type ComparisonGroup =
  | "input"
  | "config"
  | "memory"
  | "musicProfile"
  | "tools"
  | "summary";
export interface RunComparison {
  left: RunDetail;
  right: RunDetail;
  differences: Record<ComparisonGroup, DiffEntry[]>;
}
export const isTerminal = (status: RunStatus) =>
  !["uploading", "queued", "running"].includes(status);
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new WorkbenchError("INVALID_INPUT", "运行标识格式无效。");
  return value.toLowerCase();
}
export function exactFields(
  value: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new WorkbenchError("INVALID_INPUT", "请求字段无效。");
  return value as Record<string, unknown>;
}
export async function boundedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw new WorkbenchError("INVALID_INPUT", "请求内容为空。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new WorkbenchError(
          "REQUEST_TOO_LARGE",
          "请求内容超过大小限制。",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function readJson(request: Request, allowed: string[]) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new WorkbenchError("INVALID_INPUT", "请使用 JSON 请求。");
  const bytes = await boundedBody(request, 16 * 1024);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new WorkbenchError("INVALID_INPUT", "JSON 内容无效。");
  }
  return exactFields(parsed, allowed);
}
export function assertVersion(value: unknown) {
  if (value !== 1)
    throw new WorkbenchError("INVALID_INPUT", "不支持的请求契约版本。");
}
export function errorData(
  error: unknown,
  stage: Stage | null = null,
): WorkbenchErrorData {
  if (error instanceof WorkbenchError)
    return {
      code: error.code,
      message: error.message,
      stage: error.stage ?? stage,
      retryable: error.retryable,
    };
  return {
    code: "DATA_UNAVAILABLE",
    message: "服务暂时不可用，请稍后重试。",
    stage,
    retryable: true,
  };
}
export function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

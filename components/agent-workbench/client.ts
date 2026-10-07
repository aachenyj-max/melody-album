import type { WorkbenchErrorData } from "@/lib/workbench/contract";
export const API = "/api/internal/agent-workbench";
export class ApiError extends Error {
  constructor(
    public detail: WorkbenchErrorData,
    public runId?: string,
  ) {
    super(detail.message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 204) return undefined as T;
  let envelope: { data?: T; error?: WorkbenchErrorData; runId?: string };
  try {
    envelope = await response.json();
  } catch {
    throw new Error("工作台服务暂不可用，请重试。");
  }
  if (!response.ok || envelope.error)
    throw new ApiError(
      envelope.error ?? {
        code: "DATA_UNAVAILABLE",
        message: "工作台服务暂不可用。",
        retryable: true,
        stage: null,
      },
      envelope.runId,
    );
  return envelope.data as T;
}
export const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const stageNames = {
  input: "测试输入",
  memory: "记忆理解",
  music_profile: "音乐意图",
  ai_music: "AI 配乐",
  qq_recommendations: "QQ 推荐",
  summary: "最终汇总",
};
export const statusNames: Record<string, string> = {
  uploading: "保存输入中",
  queued: "等待执行",
  running: "执行中",
  succeeded: "已完成",
  partial: "部分完成",
  failed: "失败",
  interrupted: "已中断",
  pending: "未开始",
  skipped: "已跳过",
};
export const sourceNames: Record<string, string> = {
  agent: "真实 Agent",
  demo: "演示",
  api: "真实 API",
  mock: "Mock",
  deterministic: "确定性转换",
  none: "无",
};
export function when(value: string | null) {
  if (!value) return "未提供";
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "时间无效";
  // The server and browser can use different time zones and ICU versions.
  // ISO formatting with an explicit UTC+8 offset keeps hydration identical.
  const beijing = new Date(milliseconds + 8 * 60 * 60 * 1000);
  return `${beijing.toISOString().slice(0, 19).replace("T", " ")}（北京时间）`;
}

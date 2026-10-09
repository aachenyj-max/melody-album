import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHuman } from "./auth";
import { activeConfig, canonical, configDigest, sha256 } from "./config";
import {
  boundedBody,
  errorData,
  RUN_STATUSES,
  STAGES,
  uuid,
  WorkbenchError,
  type AssetState,
  type ConfigSnapshot,
  type InputSnapshot,
  type Json,
  type RunDetail,
  type RunListItem,
  type RunStatus,
  type Source,
  type Stage,
  type StepDetail,
} from "./contract";

export const INPUT_BUCKET = "agent-workbench-test-inputs";
interface RunRow {
  id: string;
  parent_run_id: string | null;
  kind: "internal_test";
  status: RunStatus;
  created_at: string;
  expires_at: string;
  started_at: string | null;
  ended_at: string | null;
  input_snapshot: InputSnapshot;
  config_snapshot: ConfigSnapshot;
  config_digest: string;
  error: RunDetail["error"];
  summary: Json;
}
interface AssetRow {
  position: number;
  storage_path: string;
  sha256: string;
  byte_size: number;
  state: AssetState;
}
interface StepRow {
  stage: Stage;
  status: StepDetail["status"];
  driver: StepDetail["driver"];
  source: Source;
  started_at: string | null;
  ended_at: string | null;
  result: Json;
  calls: StepDetail["calls"];
  events: StepDetail["events"];
  error: StepDetail["error"];
}
interface StoredRun {
  run: RunRow;
  assets: AssetRow[];
  steps: StepRow[];
}
const notFound = () =>
  new WorkbenchError("NOT_FOUND", "运行不存在或已过期。", 404);
function databaseError(error: { message: string }): never {
  const known: Record<string, [number, string]> = {
    NOT_FOUND: [404, "运行不存在或已过期。"],
    REQUEST_CONFLICT: [409, "相同提交标识对应的输入或配置不同。"],
    RUN_BUSY: [409, "运行已在执行，请查看进度。"],
    RUN_NOT_READY: [409, "运行输入尚未准备完成。"],
    CONCURRENCY_LIMIT: [429, "已有两条运行在执行，请稍后重试。"],
    WRITE_REJECTED: [409, "执行已结束或租约失效。"],
  };
  for (const [code, [status, message]] of Object.entries(known))
    if (error.message === code) throw new WorkbenchError(code, message, status);
  throw new WorkbenchError(
    "DATA_UNAVAILABLE",
    "内部数据暂时不可用。",
    503,
    null,
    true,
  );
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) {
    console.error("Workbench database request failed", {
      function: name,
      code: error.code,
      transportClass: [
        "fetch failed",
        "aborted",
        "signal",
        "JSON",
        "Body",
      ].filter((label) => error.message.includes(label)),
    });
    databaseError(error);
  }
  return data as T;
}
async function stored(ids: string[]): Promise<StoredRun[]> {
  await requireHuman();
  const valid = ids.map(uuid);
  const records = await rpc<StoredRun[]>("agent_workbench_read", {
    p_ids: valid,
  });
  if (records.length !== new Set(valid).size) throw notFound();
  return valid.map((id) => {
    const record = records.find((item) => item.run.id === id);
    if (!record) throw notFound();
    return record;
  });
}
function dto({ run: r, steps, assets }: StoredRun): RunDetail {
  return {
    runId: r.id,
    parentRunId: r.parent_run_id,
    kind: r.kind,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    inputSnapshot: r.input_snapshot,
    configSnapshot: r.config_snapshot,
    configDigest: r.config_digest,
    photos: assets
      .filter((a) => a.state === "ready")
      .map((a) => ({
        position: a.position,
        previewUrl: `/api/internal/agent-workbench/runs/${r.id}/photos/${a.position}`,
      })),
    steps: STAGES.map((stage) => {
      const s = steps.find((s) => s.stage === stage);
      if (!s)
        throw new WorkbenchError("DATA_UNAVAILABLE", "阶段记录不完整。", 503);
      return {
        stage: s.stage,
        status: s.status,
        driver: s.driver,
        source: s.source,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        result: s.result,
        calls: s.calls,
        events: s.events,
        error: s.error,
      };
    }),
    summary: r.summary,
    error: r.error,
  };
}
export async function getRun(id: string) {
  return dto((await stored([id]))[0]);
}
export async function getRunsTogether(a: string, b: string) {
  return (await stored([a, b])).map(dto) as [RunDetail, RunDetail];
}
function listItem(r: RunRow): RunListItem {
  return {
    runId: r.id,
    parentRunId: r.parent_run_id,
    kind: r.kind,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    configDigest: r.config_digest,
    inputSummary: {
      photoCount: r.input_snapshot.photoCount,
      hasStory: !!r.input_snapshot.story,
    },
    versions: {
      prompt: r.config_snapshot.prompt.version,
      loop: r.config_snapshot.loop.version,
    },
    sources: {
      memory: r.config_snapshot.memoryModel.mode,
      music: r.config_snapshot.music.mode,
      recommendation: "mock",
    },
  };
}
function iso(value: string | null) {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new WorkbenchError("INVALID_INPUT", "时间筛选格式无效。");
  return new Date(value).toISOString();
}
export async function listRuns(query: URLSearchParams) {
  await requireHuman();
  if (
    [...query.keys()].some(
      (k) => !["status", "runId", "from", "to", "limit", "cursor"].includes(k),
    ) ||
    [...new Set(query.keys())].some((k) => query.getAll(k).length !== 1)
  )
    throw new WorkbenchError("INVALID_INPUT", "筛选字段无效。");
  const status = query.get("status");
  if (status && !RUN_STATUSES.includes(status as RunStatus))
    throw new WorkbenchError("INVALID_INPUT", "运行状态无效。");
  const limit = Number(query.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new WorkbenchError("INVALID_INPUT", "列表数量须为 1–50。");
  const from = iso(query.get("from")),
    to = iso(query.get("to"));
  if (from && to && from > to)
    throw new WorkbenchError("INVALID_INPUT", "时间区间顺序无效。");
  let cursorTime: string | null = null,
    cursorId: string | null = null;
  if (query.has("cursor")) {
    try {
      const value = JSON.parse(
        Buffer.from(query.get("cursor") ?? "", "base64url").toString(),
      );
      if (!Array.isArray(value) || value.length !== 2) throw new Error();
      cursorTime = iso(value[0]);
      cursorId = uuid(value[1]);
      if (!cursorTime) throw new Error();
    } catch {
      throw new WorkbenchError("INVALID_INPUT", "分页游标无效。");
    }
  }
  const rows = await rpc<RunRow[]>("agent_workbench_list", {
    p_status: status,
    p_id: query.has("runId") ? uuid(query.get("runId")) : null,
    p_from: from,
    p_to: to,
    p_limit: limit + 1,
    p_cursor_time: cursorTime,
    p_cursor_id: cursorId,
  });
  const page = rows.slice(0, limit),
    last = page.at(-1);
  return {
    items: page.map(listItem),
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(JSON.stringify([last.created_at, last.id])).toString(
            "base64url",
          )
        : null,
  };
}
export interface UploadInput {
  requestId: string;
  story: string;
  photos: Uint8Array[];
  chatMode?: true;
}
export async function parseUpload(request: Request): Promise<UploadInput> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data;"))
    throw new WorkbenchError("INVALID_INPUT", "请使用照片表单提交。");
  const bytes = await boundedBody(request, 3.5 * 1024 * 1024);
  let form: FormData;
  try {
    form = await new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes.buffer as ArrayBuffer,
    }).formData();
  } catch {
    throw new WorkbenchError("INVALID_INPUT", "照片表单无效。");
  }
  if (
    [...form.keys()].some(
      (k) =>
        ![
          "contractVersion",
          "requestId",
          "story",
          "photos",
          "chatMode",
        ].includes(k),
    ) ||
    ["contractVersion", "requestId", "story"].some(
      (k) => form.getAll(k).length !== 1,
    ) ||
    form.get("contractVersion") !== "1" ||
    (form.has("chatMode") &&
      (form.getAll("chatMode").length !== 1 || form.get("chatMode") !== "1"))
  )
    throw new WorkbenchError("INVALID_INPUT", "表单字段或契约版本无效。");
  const story = form.get("story");
  if (typeof story !== "string" || story.trim().length > 1000)
    throw new WorkbenchError("INVALID_STORY", "故事最多 1000 字。");
  const files = form.getAll("photos");
  if (files.length < 1 || files.length > 9)
    throw new WorkbenchError("INVALID_INPUT", "请选择 1–9 张照片。");
  const photos: Uint8Array[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.type !== "image/jpeg" || file.size < 4)
      throw new WorkbenchError("INVALID_INPUT", "照片必须是压缩 JPEG 输入。");
    const photo = new Uint8Array(await file.arrayBuffer());
    if (photo[0] !== 255 || photo[1] !== 216 || photo[2] !== 255)
      throw new WorkbenchError("INVALID_INPUT", "JPEG 内容无效。");
    photos.push(photo);
  }
  return {
    requestId: uuid(form.get("requestId")),
    story: story.trim(),
    photos,
    ...(form.get("chatMode") === "1" ? { chatMode: true as const } : {}),
  };
}
async function createRecord(
  input: UploadInput,
  config: ConfigSnapshot,
  parent: string | null = null,
) {
  await requireHuman();
  const id = randomUUID();
  const photos = input.photos.map((photo, position) => ({
    position,
    sha256: sha256(photo),
    byteSize: photo.byteLength,
  }));
  const snapshot: InputSnapshot = {
    contractVersion: 1,
    ...(input.chatMode ? { chatMode: true } : {}),
    story: input.story,
    photoCount: photos.length,
    photoOrder: photos.map((p) => p.position),
    photos,
  };
  const created = await rpc<{ run: RunRow; created: boolean }>(
    "agent_workbench_create",
    {
      p_id: id,
      p_request_id: uuid(input.requestId),
      p_parent_id: parent,
      p_input: snapshot,
      p_input_digest: sha256(canonical(snapshot)),
      p_config: config,
      p_config_digest: configDigest(config),
      p_assets: photos.map((p) => ({
        id: randomUUID(),
        position: p.position,
        byte_size: p.byteSize,
        sha256: p.sha256,
      })),
    },
  );
  if (!created.created)
    return { detail: await getRun(created.run.id), created: false };
  try {
    for (let offset = 0; offset < photos.length; offset += 3) {
      if (parent) await stored([parent]);
      const uploads = await Promise.allSettled(
        photos.slice(offset, offset + 3).map(async (photo) => {
          const path = `runs/${id}/photos/${photo.position}.jpg`;
          const { error } = await createAdminClient()
            .storage.from(INPUT_BUCKET)
            .upload(path, input.photos[photo.position], {
              contentType: "image/jpeg",
              upsert: false,
            });
          if (error)
            throw new WorkbenchError(
              "DATA_UNAVAILABLE",
              "测试照片持久化失败。",
              503,
              "input",
              true,
            );
          await rpc("agent_workbench_input_state", {
            p_id: id,
            p_position: photo.position,
          });
        }),
      );
      // Settle every started upload before marking failure, so no late upload escapes its manifest.
      const rejected = uploads.find((upload) => upload.status === "rejected");
      if (rejected?.status === "rejected") throw rejected.reason;
    }
    if (parent) await stored([parent]);
    await rpc("agent_workbench_input_state", { p_id: id });
  } catch (error) {
    const detail = errorData(error, "input");
    try {
      await rpc("agent_workbench_input_state", { p_id: id, p_error: detail });
    } catch {
      /* Reserved manifest remains available to maintenance. */
    }
    throw new WorkbenchError(
      "DATA_UNAVAILABLE",
      "测试输入未完整保存，请查看本次失败记录。",
      503,
      "input",
      true,
      id,
    );
  }
  return { detail: await getRun(id), created: true };
}
export async function createRun(input: UploadInput) {
  await requireHuman();
  return createRecord(input, await activeConfig());
}
export async function loadInputs(id: string) {
  const record = (await stored([id]))[0];
  const assets = record.assets;
  if (
    assets.length !== record.run.input_snapshot.photoCount ||
    assets.some((a) => a.state !== "ready")
  )
    throw new WorkbenchError(
      "INPUT_UNAVAILABLE",
      "测试照片快照不完整。",
      422,
      "input",
    );
  const photos: Uint8Array[] = [];
  for (const asset of assets) {
    await stored([id]);
    const { data, error } = await createAdminClient()
      .storage.from(INPUT_BUCKET)
      .download(asset.storage_path);
    if (error || !data)
      throw new WorkbenchError(
        "INPUT_UNAVAILABLE",
        "测试照片已不可读取。",
        422,
        "input",
      );
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (sha256(bytes) !== asset.sha256 || bytes.byteLength !== asset.byte_size)
      throw new WorkbenchError(
        "INPUT_UNAVAILABLE",
        "照片快照校验失败。",
        422,
        "input",
      );
    photos.push(bytes);
  }
  await stored([id]);
  return { story: record.run.input_snapshot.story, photos };
}
export async function getPhoto(id: string, index: string) {
  await requireHuman();
  if (!/^[0-8]$/.test(index)) throw notFound();
  const record = (await stored([id]))[0];
  const asset = record.assets.find(
    (a) => a.position === Number(index) && a.state === "ready",
  );
  if (!asset) throw notFound();
  const { data, error } = await createAdminClient()
    .storage.from(INPUT_BUCKET)
    .download(asset.storage_path);
  if (error || !data) throw notFound();
  await stored([id]);
  return data;
}
export async function claimRun(id: string) {
  await requireHuman();
  return rpc<{ terminal: boolean; token?: string }>("agent_workbench_claim", {
    p_id: uuid(id),
  });
}
export async function writeStep(
  id: string,
  token: string,
  stage: Stage,
  step: Pick<StepDetail, "status" | "source"> &
    Partial<Pick<StepDetail, "result" | "error" | "calls" | "events">>,
) {
  await requireHuman();
  await rpc("agent_workbench_step", {
    p_id: uuid(id),
    p_token: uuid(token),
    p_stage: stage,
    p_step: { result: null, error: null, calls: [], events: [], ...step },
  });
}
export async function finishRun(
  id: string,
  token: string,
  status: RunStatus,
  summary: Json,
  error: RunDetail["error"] = null,
) {
  await requireHuman();
  await rpc("agent_workbench_finish", {
    p_id: uuid(id),
    p_token: uuid(token),
    p_status: status,
    p_summary: summary,
    p_error: error,
  });
}
export async function rerunRecord(
  id: string,
  requestId: string,
  config: ConfigSnapshot,
) {
  await requireHuman();
  const original = await getRun(id);
  const inputs = await loadInputs(id);
  return createRecord(
    {
      requestId: uuid(requestId),
      ...inputs,
      ...(original.inputSnapshot.chatMode ? { chatMode: true as const } : {}),
    },
    config,
    uuid(id),
  );
}

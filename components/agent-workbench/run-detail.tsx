"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isTerminal,
  type ConfigSnapshot,
  type Json,
  type RunDetail,
} from "@/lib/workbench/contract";
import {
  api,
  ApiError,
  postJson,
  sourceNames,
  stageNames,
  statusNames,
  when,
} from "./client";

function AudioResult({ value }: { value: Json }) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const track = value.track;
  const tracks = Array.isArray(value.tracks)
    ? value.tracks
    : track
      ? [track]
      : [];
  return (
    <>
      {tracks.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          return null;
        const url =
          typeof item.audioUrl === "string" &&
          (item.audioUrl.startsWith("/audio/music-album/") ||
            item.audioUrl.startsWith("https://"))
            ? item.audioUrl
            : null;
        return (
          <div
            className="wb-audio"
            key={typeof item.id === "string" ? item.id : index}
          >
            <p>{typeof item.title === "string" ? item.title : "配乐"}</p>
            {url ? (
              /* biome-ignore lint/a11y/useMediaCaption: these instrumental tracks contain no spoken dialogue; titles and sources are adjacent. */
              <audio
                controls
                preload="none"
                src={url}
                onError={() =>
                  setFailed((previous) => ({ ...previous, [index]: true }))
                }
              >
                浏览器不支持音频播放。
              </audio>
            ) : (
              <p className="wb-muted">只有歌曲信息，暂无可播放音源。</p>
            )}
            {failed[index] && (
              <p className="wb-error" role="status">
                音源暂时无法播放，可能已过期；历史结果仍保留。
              </p>
            )}
            {url && !failed[index] && value.availability === "unverified" && (
              <p className="wb-muted">
                供应商已返回音源，实际可播放性以播放器为准。
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
export function RunDetailView({
  initial,
  autoStart,
}: {
  initial: RunDetail;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [selection, setSelection] = useState<"current" | "original">("current");
  const [preview, setPreview] = useState<{
    configSnapshot: ConfigSnapshot | null;
    currentReason: string | null;
    original: {
      configSnapshot: ConfigSnapshot;
      originalExecutable: boolean;
      reason: string | null;
    };
  } | null>(null);
  const started = useRef(false);
  const rerunId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    api<typeof preview>(`/config?originalRunId=${run.runId}`)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((value) => {
        if (active) setError(value.message);
      });
    return () => {
      active = false;
    };
  }, [run.runId]);
  const execute = useCallback(async () => {
    if (executing) return;
    setExecuting(true);
    setError("");
    try {
      const result = await api<RunDetail>(
        `/runs/${run.runId}/execute`,
        postJson({ contractVersion: 1 }),
      );
      setRun(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "执行请求中断，请重新读取记录。",
      );
    } finally {
      setExecuting(false);
    }
  }, [executing, run.runId]);
  useEffect(() => {
    if (autoStart && run.status === "queued" && !started.current) {
      started.current = true;
      void execute();
    }
  }, [autoStart, run.status, execute]);
  useEffect(() => {
    if (isTerminal(run.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<RunDetail>(`/runs/${run.runId}`);
        if (active) {
          setRun(next);
          if (isTerminal(next.status)) return;
        }
      } catch (value) {
        if (active)
          setError(
            value instanceof Error ? value.message : "读取进度失败，请重试。",
          );
      }
      if (active) timer = setTimeout(poll, 1000);
    }
    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [run.runId, run.status]);
  async function rerun() {
    setRerunning(true);
    setError("");
    try {
      rerunId.current ??= crypto.randomUUID();
      const result = await api<RunDetail>(
        `/runs/${run.runId}/rerun`,
        postJson({
          contractVersion: 1,
          requestId: rerunId.current,
          configSelection: selection,
        }),
      );
      router.push(
        `/internal/agent-workbench/runs/${result.runId}${result.status === "queued" ? "?execute=1" : ""}`,
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : "重跑失败。");
      if (value instanceof ApiError && value.runId)
        router.push(`/internal/agent-workbench/runs/${value.runId}`);
    } finally {
      setRerunning(false);
    }
  }
  const selectedConfig =
    selection === "original"
      ? preview?.original.configSnapshot
      : preview?.configSnapshot;
  return (
    <>
      <Link href="/internal/agent-workbench" className="wb-back">
        返回工作台
      </Link>
      <header className="wb-heading">
        <div>
          <h1>运行详情</h1>
          <p>
            内部测试 ·{" "}
            <span className="wb-status" data-status={run.status}>
              {statusNames[run.status]}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="wb-secondary"
          onClick={async () => {
            try {
              setRun(await api<RunDetail>(`/runs/${run.runId}`));
              setError("");
            } catch (value) {
              setError(value instanceof Error ? value.message : "读取失败。");
            }
          }}
        >
          重新读取
        </button>
      </header>
      <section className="wb-panel">
        <dl className="wb-run-meta">
          <dt>运行 ID</dt>
          <dd>
            <code>{run.runId}</code>
          </dd>
          <dt>创建 / 到期</dt>
          <dd>
            {when(run.createdAt)} / {when(run.expiresAt)}
          </dd>
          <dt>开始 / 结束</dt>
          <dd>
            {when(run.startedAt)} / {when(run.endedAt)}
          </dd>
          <dt>配置摘要</dt>
          <dd>
            <code>{run.configDigest}</code>
          </dd>
          {run.parentRunId && (
            <>
              <dt>原运行</dt>
              <dd>
                <Link
                  href={`/internal/agent-workbench/runs/${run.parentRunId}`}
                >
                  {run.parentRunId}
                </Link>
                （原运行到期后不可访问）
              </dd>
            </>
          )}
        </dl>
        {error && (
          <p className="wb-error" role="alert">
            {error}
          </p>
        )}
        {run.error && (
          <p className="wb-error">
            {run.error.code}：{run.error.message}
          </p>
        )}
        {run.status === "queued" && (
          <button
            type="button"
            disabled={executing}
            onClick={() => void execute()}
          >
            {executing ? "执行请求已发起…" : "执行这条待运行记录"}
          </button>
        )}
        <details>
          <summary>本次历史配置（只读）</summary>
          <pre>{JSON.stringify(run.configSnapshot, null, 2)}</pre>
        </details>
      </section>
      <section className="wb-panel">
        <h2>测试输入</h2>
        <p className="wb-story">{run.inputSnapshot.story || "故事未提供"}</p>
        <div className="wb-detail-photos">
          {run.photos.map((photo) => (
            <figure key={photo.position}>
              {/* biome-ignore lint/performance/noImgElement: private photos must bypass shared image optimization. */}
              <img
                src={photo.previewUrl}
                alt={`实际模型输入照片 ${photo.position + 1}`}
              />
              <figcaption>照片 {photo.position + 1}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <ol className="wb-stages">
        {run.steps.map((step, index) => (
          <li className="wb-panel" key={step.stage}>
            <header className="wb-heading">
              <h2>
                <span className="wb-stage-number">{index + 1}</span>
                {stageNames[step.stage]}
              </h2>
              <span className="wb-status" data-status={step.status}>
                {statusNames[step.status]}
              </span>
            </header>
            <p className="wb-muted">
              驱动：{step.driver}　来源：{sourceNames[step.source]}　
              {step.startedAt && step.endedAt
                ? `${Math.max(0, Date.parse(step.endedAt) - Date.parse(step.startedAt))} ms`
                : step.status === "running"
                  ? "执行中"
                  : ""}
            </p>
            {step.error && (
              <p className="wb-error">
                {step.error.code}：{step.error.message}
              </p>
            )}
            {step.result === null ? (
              <p className="wb-muted">
                {step.status === "skipped"
                  ? "依赖阶段未成功，本阶段已跳过。"
                  : "暂无阶段结果。"}
              </p>
            ) : (
              <>
                <AudioResult value={step.result} />
                <details
                  open={
                    step.stage === "memory" || step.stage === "music_profile"
                  }
                >
                  <summary>结构化结果</summary>
                  <pre>{JSON.stringify(step.result, null, 2)}</pre>
                </details>
              </>
            )}
            {!!step.calls.length && (
              <details>
                <summary>工具调用（{step.calls.length}）</summary>
                <pre>{JSON.stringify(step.calls, null, 2)}</pre>
              </details>
            )}
            {!!step.events.length && (
              <details>
                <summary>Pi 事件摘要（{step.events.length}）</summary>
                <pre>{JSON.stringify(step.events, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
      <section className="wb-panel">
        <h2>使用相同输入手动重跑</h2>
        <p>生成新记录，原输入、配置和结果保持只读。</p>
        <fieldset>
          <legend>新运行配置</legend>
          <label>
            <input
              type="radio"
              name="configSelection"
              value="current"
              disabled={!preview?.configSnapshot}
              checked={selection === "current"}
              onChange={() => {
                setSelection("current");
                rerunId.current = null;
              }}
            />
            当前配置（默认）
          </label>
          <label>
            <input
              type="radio"
              name="configSelection"
              value="original"
              checked={selection === "original"}
              disabled={!preview?.original.originalExecutable}
              onChange={() => {
                setSelection("original");
                rerunId.current = null;
              }}
            />
            原运行配置
          </label>
        </fieldset>
        {preview?.currentReason && (
          <p className="wb-error">当前配置不可执行：{preview.currentReason}</p>
        )}
        {preview && !preview.original.originalExecutable && (
          <p className="wb-error">原版不可执行：{preview.original.reason}</p>
        )}
        {selectedConfig && (
          <details>
            <summary>
              确认实际使用的配置：{selectedConfig.prompt.version} /{" "}
              {selectedConfig.memoryModel.mode} / {selectedConfig.music.mode}
            </summary>
            <pre>{JSON.stringify(selectedConfig, null, 2)}</pre>
          </details>
        )}
        <button
          type="button"
          disabled={
            rerunning ||
            !selectedConfig ||
            run.photos.length !== run.inputSnapshot.photoCount
          }
          onClick={() => void rerun()}
        >
          {rerunning ? "复制输入并创建新记录…" : "使用所选配置重跑"}
        </button>
        <p className="wb-muted">输入不完整或原记录到期时无法重跑。</p>
      </section>
    </>
  );
}

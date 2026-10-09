"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  prepareAnalysisFiles,
  validateSources,
  type PhotoInput,
} from "@/components/music-album/photo-preparation";
import {
  RUN_STATUSES,
  type ConfigSnapshot,
  type RunDetail,
  type RunListItem,
} from "@/lib/workbench/contract";
import type { EditableConfig } from "@/lib/workbench/config";
import { api, ApiError, postJson, statusNames, when } from "./client";

export function Workbench({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [story, setStory] = useState("");
  const [interactive, setInteractive] = useState(true);
  const [config, setConfig] = useState<ConfigSnapshot | null>(null);
  const [editable, setEditable] = useState<EditableConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState("");
  const [userAgent, setUserAgent] = useState<{
    configVersion: number;
    mode: "demo" | "live";
  } | null>(null);
  const [userAgentReason, setUserAgentReason] = useState<string | null>(null);
  const [items, setItems] = useState<RunListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [failedRun, setFailedRun] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    status: "",
    runId: "",
    from: "",
    to: "",
  });
  const requestId = useRef<string | null>(null);
  const photoRef = useRef(photos);
  photoRef.current = photos;
  useEffect(
    () => () => {
      for (const photo of photoRef.current)
        URL.revokeObjectURL(photo.previewUrl);
    },
    [],
  );
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    api<{
      configSnapshot: ConfigSnapshot;
      editable: EditableConfig;
      userAgent: { configVersion: number; mode: "demo" | "live" } | null;
      userAgentReason: string | null;
    }>("/config")
      .then((result) => {
        if (active) {
          setConfig(result.configSnapshot);
          setEditable(result.editable);
          setUserAgent(result.userAgent);
          setUserAgentReason(result.userAgentReason);
        }
      })
      .catch((value) => {
        if (active) setError(value.message);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    api<{ items: RunListItem[]; nextCursor: string | null }>("/runs")
      .then((result) => {
        if (active) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      })
      .catch((value) => {
        if (active) setListError(value.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/session", postJson({ password }));
      setPassword("");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "验证失败。");
    } finally {
      setBusy(false);
    }
  }
  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    if (!editable) return;
    setSavingConfig(true);
    setConfigNotice("");
    try {
      const result = await api<{
        editable: EditableConfig;
        configSnapshot: ConfigSnapshot;
      }>("/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: editable.version,
          promptText: editable.promptText,
          skillText: editable.skillText,
          maxTurns: editable.maxTurns,
          maxOutputTokens: editable.maxOutputTokens,
        }),
      });
      setEditable(result.editable);
      setConfig(result.configSnapshot);
      setConfigNotice(
        `已保存配置版本 ${result.editable.version}。新测试将使用此版本。`,
      );
      requestId.current = null;
    } catch (value) {
      setConfigNotice(value instanceof Error ? value.message : "保存失败。");
    } finally {
      setSavingConfig(false);
    }
  }
  function choose(files: File[]) {
    const problem = validateSources(photos, files);
    if (problem) {
      setError(problem);
      return;
    }
    requestId.current = null;
    setError("");
    setPhotos([
      ...photos,
      ...files.map((file, offset) => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        analysisFile: null,
        position: photos.length + offset,
        readState: "ready" as const,
      })),
    ]);
  }
  function changePhoto(index: number, direction: -1 | 0 | 1) {
    if (busy) return;
    const next = [...photos];
    if (direction === 0) {
      const [removed] = next.splice(index, 1);
      URL.revokeObjectURL(removed.previewUrl);
    } else {
      const other = index + direction;
      if (other < 0 || other >= next.length) return;
      [next[index], next[other]] = [next[other], next[index]];
    }
    requestId.current = null;
    setPhotos(next.map((photo, position) => ({ ...photo, position })));
  }
  async function start(event: FormEvent) {
    event.preventDefault();
    if (!photos.length || story.trim().length > 1000 || !config) {
      setError("请检查照片、故事和可执行配置。");
      return;
    }
    setBusy(true);
    setError("");
    setFailedRun(null);
    try {
      const compressed = await prepareAnalysisFiles(photos, story);
      requestId.current ??= crypto.randomUUID();
      const body = new FormData();
      body.set("contractVersion", "1");
      body.set("requestId", requestId.current);
      body.set("story", story.trim());
      if (interactive) body.set("chatMode", "1");
      for (const file of compressed) body.append("photos", file);
      const run = await api<RunDetail>("/runs", { method: "POST", body });
      router.push(
        `/internal/agent-workbench/runs/${run.runId}${run.status === "queued" && !interactive ? "?execute=1" : ""}`,
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : "提交失败，请重试。");
      if (value instanceof ApiError && value.runId) setFailedRun(value.runId);
    } finally {
      setBusy(false);
    }
  }
  async function load(more = false) {
    setLoading(true);
    setListError("");
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filter))
        if (value)
          query.set(
            key,
            key === "from" || key === "to"
              ? new Date(`${value}+08:00`).toISOString()
              : value,
          );
      if (more && nextCursor) query.set("cursor", nextCursor);
      const result = await api<{
        items: RunListItem[];
        nextCursor: string | null;
      }>(`/runs?${query}`);
      setItems((previous) =>
        more ? [...previous, ...result.items] : result.items,
      );
      setNextCursor(result.nextCursor);
      if (!more) setSelected([]);
    } catch (value) {
      setListError(
        value instanceof Error ? value.message : "筛选无效，请检查后重试。",
      );
    } finally {
      setLoading(false);
    }
  }
  if (!authenticated)
    return (
      <section className="wb-login">
        <h1>内部 Agent 工作台</h1>
        <p>验证内部口令后查看测试记录。</p>
        <form onSubmit={signIn}>
          <label htmlFor="wb-password">内部访问口令</label>
          <input
            id="wb-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={1024}
          />
          <button type="submit" disabled={busy}>
            {busy ? "验证中…" : "进入工作台"}
          </button>
        </form>
        {error && (
          <p className="wb-error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <>
      <header className="wb-heading">
        <div>
          <h1>Agent 工作台</h1>
          <p>内部测试 · 输入与结果保留 30 天</p>
        </div>
        <button
          type="button"
          className="wb-secondary"
          onClick={async () => {
            try {
              await api("/session", { method: "DELETE" });
              router.refresh();
            } catch (value) {
              setError(value instanceof Error ? value.message : "退出失败。");
            }
          }}
        >
          退出
        </button>
      </header>
      <div className="wb-start-grid">
        <section className="wb-panel">
          <h2>新建测试</h2>
          <form onSubmit={start}>
            <label htmlFor="wb-photos">测试照片（1–9 张）</label>
            <input
              id="wb-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={(event) => {
                choose(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <p className="wb-muted">
              单张不超过 10 MiB，合计不超过 50 MiB；提交时压缩为实际模型输入。
            </p>
            <ol className="wb-photo-list">
              {photos.map((photo, index) => (
                <li key={photo.localId}>
                  {/* biome-ignore lint/performance/noImgElement: local previews and authenticated images must bypass shared optimization. */}
                  <img src={photo.previewUrl} alt={`测试照片 ${index + 1}`} />
                  <span>照片 {index + 1}</span>
                  <div>
                    <button
                      type="button"
                      className="wb-secondary"
                      disabled={busy || index === 0}
                      onClick={() => changePhoto(index, -1)}
                      aria-label={`照片 ${index + 1} 前移`}
                    >
                      前移
                    </button>
                    <button
                      type="button"
                      className="wb-secondary"
                      disabled={busy || index === photos.length - 1}
                      onClick={() => changePhoto(index, 1)}
                      aria-label={`照片 ${index + 1} 后移`}
                    >
                      后移
                    </button>
                    <button
                      type="button"
                      className="wb-secondary"
                      disabled={busy}
                      onClick={() => changePhoto(index, 0)}
                      aria-label={`移除照片 ${index + 1}`}
                    >
                      移除
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <label htmlFor="wb-story">补充故事（可选）</label>
            <textarea
              id="wb-story"
              rows={4}
              value={story}
              maxLength={1100}
              disabled={busy}
              onChange={(event) => {
                setStory(event.target.value);
                requestId.current = null;
              }}
            />
            <p className="wb-muted">{story.trim().length}/1000 字</p>
            <label className="wb-mode-choice">
              <input
                type="checkbox"
                checked={interactive}
                disabled={busy}
                onChange={(event) => {
                  setInteractive(event.target.checked);
                  requestId.current = null;
                }}
              />
              先与 Agent 多轮讨论，确认意图后生成音乐
            </label>
            {error && (
              <p role="alert" className="wb-error">
                {error}
              </p>
            )}
            {failedRun && (
              <Link href={`/internal/agent-workbench/runs/${failedRun}`}>
                查看已保存的失败记录
              </Link>
            )}
            <button
              type="submit"
              disabled={
                busy || !photos.length || !config || story.trim().length > 1000
              }
            >
              {busy ? "保存测试输入…" : "开始测试运行"}
            </button>
          </form>
        </section>
        <section className="wb-panel wb-config">
          <h2>本次配置</h2>
          {userAgent && (
            <p className="wb-muted">
              本环境用户端：固定版本 {userAgent.configVersion} ·{" "}
              {userAgent.mode === "live" ? "真实理解" : "演示理解"}
              。保存工作台试验版本不会自动同步。
            </p>
          )}
          {userAgentReason && <p className="wb-muted">{userAgentReason}</p>}
          {config ? (
            <>
              <dl>
                <dt>理解</dt>
                <dd>
                  Pi / {config.memoryModel.mode === "demo" ? "演示" : "真实"}
                </dd>
                <dt>配乐</dt>
                <dd>
                  {config.music.mode === "demo" ? "演示" : "真实 ACE-Step"}
                </dd>
                <dt>推荐</dt>
                <dd>QQ 本地 Mock</dd>
                <dt>Prompt</dt>
                <dd>{config.prompt.version}</dd>
                <dt>Loop</dt>
                <dd>
                  {config.loop.version}，最多 {config.loop.maxTurns} 轮
                </dd>
                <dt>模型</dt>
                <dd>{config.memoryModel.modelDescriptor.id}</dd>
              </dl>
              {editable && (
                <details>
                  <summary>编辑工作台配置 · 版本 {editable.version}</summary>
                  <form onSubmit={saveConfig}>
                    <p className="wb-muted">
                      修改只有保存为新版本后才用于新测试；现有运行保持原快照。用户端固定使用已发布版本，测试通过后再切换版本并部署。
                    </p>
                    <label htmlFor="wb-prompt">系统提示词</label>
                    <textarea
                      id="wb-prompt"
                      rows={7}
                      value={editable.promptText}
                      maxLength={8000}
                      onChange={(event) =>
                        setEditable({
                          ...editable,
                          promptText: event.target.value,
                        })
                      }
                    />
                    <label htmlFor="wb-skill">记忆理解指令</label>
                    <textarea
                      id="wb-skill"
                      rows={7}
                      value={editable.skillText}
                      maxLength={8000}
                      onChange={(event) =>
                        setEditable({
                          ...editable,
                          skillText: event.target.value,
                        })
                      }
                    />
                    <label htmlFor="wb-turns">单次理解最多轮数（1–3）</label>
                    <input
                      id="wb-turns"
                      type="number"
                      min={1}
                      max={3}
                      value={editable.maxTurns}
                      onChange={(event) =>
                        setEditable({
                          ...editable,
                          maxTurns: Number(event.target.value),
                        })
                      }
                    />
                    <label htmlFor="wb-tokens">
                      单轮输出预算（512–2048 tokens）
                    </label>
                    <input
                      id="wb-tokens"
                      type="number"
                      min={512}
                      max={2048}
                      value={editable.maxOutputTokens}
                      onChange={(event) =>
                        setEditable({
                          ...editable,
                          maxOutputTokens: Number(event.target.value),
                        })
                      }
                    />
                    <button type="submit" disabled={savingConfig}>
                      {savingConfig ? "保存中…" : "保存为新版本"}
                    </button>
                  </form>
                  {configNotice && <p role="status">{configNotice}</p>}
                </details>
              )}
              <details>
                <summary>当前完整配置快照</summary>
                <pre>{JSON.stringify(config, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p>配置暂不可用。请检查服务端配置后刷新。</p>
          )}
          <p className="wb-muted">
            有效理解后自动继续音乐阶段。测试结果不会保存为用户相册。
          </p>
        </section>
      </div>
      <section className="wb-panel wb-history">
        <div className="wb-heading">
          <h2>运行记录</h2>
          <button
            type="button"
            className="wb-secondary"
            disabled={selected.length !== 2}
            onClick={() =>
              router.push(
                `/internal/agent-workbench/compare?a=${selected[0]}&b=${selected[1]}`,
              )
            }
          >
            对比所选 {selected.length}/2
          </button>
        </div>
        <form
          className="wb-filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label>
            状态
            <select
              value={filter.status}
              onChange={(event) =>
                setFilter({ ...filter, status: event.target.value })
              }
            >
              <option value="">全部状态</option>
              {RUN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusNames[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            运行 ID
            <input
              value={filter.runId}
              onChange={(event) =>
                setFilter({ ...filter, runId: event.target.value })
              }
              placeholder="完整 UUID"
            />
          </label>
          <label>
            开始时间（北京时间）
            <input
              type="datetime-local"
              value={filter.from}
              onChange={(event) =>
                setFilter({ ...filter, from: event.target.value })
              }
            />
          </label>
          <label>
            结束时间（北京时间）
            <input
              type="datetime-local"
              value={filter.to}
              onChange={(event) =>
                setFilter({ ...filter, to: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={loading}>
            查询
          </button>
        </form>
        {listError && (
          <p role="alert" className="wb-error">
            {listError}
          </p>
        )}
        {loading && <p role="status">读取记录中…</p>}
        {!loading && !listError && !items.length && (
          <p>还没有符合条件的记录。提交一次测试，或调整筛选条件。</p>
        )}
        {!!items.length && (
          <div className="wb-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>选择</th>
                  <th>运行 / 配置</th>
                  <th>状态</th>
                  <th>输入</th>
                  <th>来源</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.runId}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`选择运行 ${item.runId}`}
                        checked={selected.includes(item.runId)}
                        disabled={
                          !selected.includes(item.runId) && selected.length >= 2
                        }
                        onChange={(event) =>
                          setSelected((previous) =>
                            event.target.checked
                              ? [...previous, item.runId]
                              : previous.filter((id) => id !== item.runId),
                          )
                        }
                      />
                    </td>
                    <td>
                      <Link
                        href={`/internal/agent-workbench/runs/${item.runId}`}
                      >
                        <code>{item.runId}</code>
                      </Link>
                      <small>{item.versions.prompt}</small>
                      {item.parentRunId && <small>重跑记录</small>}
                    </td>
                    <td>
                      <span className="wb-status" data-status={item.status}>
                        {statusNames[item.status]}
                      </span>
                    </td>
                    <td>
                      {item.inputSummary.photoCount} 张照片
                      <br />
                      {item.inputSummary.hasStory ? "附故事" : "无故事"}
                    </td>
                    <td>
                      {item.sources.memory === "demo" ? "理解演示" : "真实理解"}
                      <br />
                      {item.sources.music === "demo" ? "配乐演示" : "真实配乐"}
                      <br />
                      QQ Mock
                    </td>
                    <td>{when(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor && (
          <button
            type="button"
            className="wb-secondary"
            disabled={loading}
            onClick={() => void load(true)}
          >
            加载更早记录
          </button>
        )}
      </section>
    </>
  );
}

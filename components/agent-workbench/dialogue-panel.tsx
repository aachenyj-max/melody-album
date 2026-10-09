"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Dialogue } from "@/lib/workbench/dialogue";
import type { RunDetail } from "@/lib/workbench/contract";
import { api, postJson, when } from "./client";

export function DialoguePanel({
  run,
  onRunChange,
}: {
  run: RunDetail;
  onRunChange: (run: RunDetail) => void;
}) {
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Dialogue>(`/runs/${run.runId}/dialogue`)
      .then((value) => {
        if (active) setDialogue(value);
      })
      .catch((value) => {
        if (active)
          setError(value instanceof Error ? value.message : "读取对话失败。");
      });
    return () => {
      active = false;
    };
  }, [run.runId]);
  async function act(
    action: "message" | "propose" | "confirm" | "resume" | "sync",
    text?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Dialogue>(
        `/runs/${run.runId}/dialogue`,
        postJson({
          contractVersion: 1,
          action,
          ...(text ? { message: text } : {}),
        }),
      );
      setDialogue(result);
      if (action === "message") setMessage("");
      if (action === "confirm" || action === "resume" || action === "sync")
        onRunChange(await api<RunDetail>(`/runs/${run.runId}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim()) void act("message", message.trim());
  }
  return (
    <section className="wb-panel wb-dialogue">
      <h2>与 Agent 讨论音乐</h2>
      <p className="wb-muted">
        本会话锁定创建时的配置。讨论不会自动调用配乐服务；确认意图后才生成。
      </p>
      {error && (
        <p className="wb-error" role="alert">
          {error}
        </p>
      )}
      {!dialogue && !error && <p role="status">读取对话中…</p>}
      {dialogue && (
        <>
          <ol className="wb-dialogue-messages" aria-label="对话记录">
            {dialogue.messages.map((item) => (
              <li
                key={`${item.at}-${item.role}-${item.text}`}
                data-role={item.role}
              >
                <strong>{item.role === "user" ? "你" : "Agent"}</strong>
                <p>{item.text}</p>
                <small>{when(item.at)}</small>
              </li>
            ))}
          </ol>
          {!dialogue.messages.length && (
            <p>
              首句故事：
              {run.inputSnapshot.story || "未提供。说说你希望音乐表达什么。"}
            </p>
          )}
          <form onSubmit={submit}>
            <label htmlFor="wb-dialogue-input">继续讨论或提出修改</label>
            <textarea
              id="wb-dialogue-input"
              rows={3}
              value={message}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button type="submit" disabled={busy || !message.trim()}>
              {busy ? "处理中…" : "发送给 Agent"}
            </button>
          </form>
          <button
            type="button"
            className="wb-secondary"
            disabled={
              busy || !dialogue.messages.some((item) => item.role === "user")
            }
            onClick={() => void act("propose")}
          >
            整理{dialogue.musicVersions.length ? "修改" : "生成"}意图
          </button>
          {dialogue.phase === "proposed" && dialogue.proposal && (
            <div className="wb-proposal">
              <h3>
                待确认的{dialogue.proposal.kind === "initial" ? "生成" : "修改"}
                意图
              </h3>
              <p>{dialogue.proposal.summary}</p>
              <p>{dialogue.proposal.music.instrumentalPrompt}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("confirm")}
              >
                {busy ? "处理中…" : "确认并生成音乐"}
              </button>
              <p className="wb-muted">想调整意图可继续发送消息，再次整理。</p>
            </div>
          )}
          {dialogue.phase === "approved" && (
            <div>
              <p role="status">
                {run.status === "queued" || run.status === "running"
                  ? "已确认意图，正在执行音乐阶段。"
                  : "本次生成已结束。若音乐阶段失败，可从下方复制输入重试；原对话会保留。"}
              </p>
              {run.status === "queued" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("resume")}
                >
                  继续执行已确认意图
                </button>
              )}
              {(run.status === "succeeded" || run.status === "partial") && (
                <button
                  type="button"
                  className="wb-secondary"
                  disabled={busy}
                  onClick={() => void act("sync")}
                >
                  读取已完成音乐版本
                </button>
              )}
            </div>
          )}
          {!!dialogue.musicVersions.length && (
            <div>
              <h3>音乐版本</h3>
              <ol className="wb-music-versions">
                {dialogue.musicVersions.map((version, index) => {
                  const result = version.result;
                  const track =
                    result &&
                    typeof result === "object" &&
                    !Array.isArray(result)
                      ? result.track
                      : null;
                  const audioUrl =
                    track && typeof track === "object" && !Array.isArray(track)
                      ? track.audioUrl
                      : null;
                  return (
                    <li key={version.id}>
                      <strong>版本 {index + 1}</strong> ·{" "}
                      {when(version.createdAt)}
                      <p>{version.proposal.summary}</p>
                      {typeof audioUrl === "string" &&
                        (audioUrl.startsWith("https://") ||
                          audioUrl.startsWith("/audio/music-album/")) && (
                          /* biome-ignore lint/a11y/useMediaCaption: instrumental music has no speech. */
                          <audio controls preload="none" src={audioUrl}>
                            浏览器不支持播放。
                          </audio>
                        )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

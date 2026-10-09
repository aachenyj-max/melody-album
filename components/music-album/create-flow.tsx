"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Plus, Sparkles } from "lucide-react";
import {
  activeTurn,
  CREATION_BUCKET,
  type CreationDraft,
  type DirectionCard,
} from "@/lib/creation/contract";
import { creationApi, snapshotInput } from "@/lib/creation/client";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { photo } from "./demo-data";
import { CreationDialogue } from "./creation-dialogue";
import { useCreationSession } from "./creation-session";

export function CreateFlow() {
  const router = useRouter();
  const { confirm } = useCreationSession();
  const [draft, setDraft] = useState<CreationDraft | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manager, setManager] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const transport = useRef(false);
  const boot = useRef<Promise<CreationDraft> | null>(null);
  const unsent = useRef<{ id: string; text: string } | null>(null);
  const uploadRetry = useRef<{
    requestId: string;
    files: File[];
    ids: string[];
    previous: string[];
  } | null>(null);
  const adopt = useCallback((next: CreationDraft) => {
    setDraft((current) =>
      current && current.id === next.id && current.revision > next.revision
        ? current
        : next,
    );
  }, []);
  const refresh = useCallback(
    async (id: string) => {
      const next = await creationApi<CreationDraft>(
        `/api/creation/drafts/${id}`,
      );
      adopt(next);
      return next;
    },
    [adopt],
  );
  useEffect(() => {
    let mounted = true;
    boot.current ??= (async () => {
      const query = new URLSearchParams(window.location.search);
      const id =
        query.get("draft") ||
        (!query.has("new")
          ? localStorage.getItem("music-creation-draft")
          : null);
      if (id) return creationApi<CreationDraft>(`/api/creation/drafts/${id}`);
      return creationApi<CreationDraft>("/api/creation/drafts", {
        requestId: crypto.randomUUID(),
      });
    })();
    void boot.current
      .then((next) => {
        if (!mounted) return;
        localStorage.setItem("music-creation-draft", next.id);
        window.history.replaceState(
          null,
          "",
          `/create?draft=${next.id}${next.messages.length ? "&state=understanding" : ""}`,
        );
        adopt(next);
      })
      .catch((e: Error) => {
        if (mounted) setError(e.message);
      });
    return () => {
      mounted = false;
    };
  }, [adopt]);
  const turn = draft ? activeTurn(draft) : undefined;
  const processing = busy || turn?.status === "running";
  const draftId = draft?.id;
  const messageCount = draft?.messages.length || 0;
  useEffect(() => {
    if (!draftId || !["running", "pending"].includes(turn?.status || ""))
      return;
    const timer = window.setInterval(() => {
      void refresh(draftId).catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [draftId, turn?.status, refresh]);
  useEffect(() => {
    if (!draftId) return;
    window.history.replaceState(
      null,
      "",
      `/create?draft=${draftId}${messageCount ? "&state=understanding" : ""}`,
    );
  }, [draftId, messageCount]);
  useEffect(() => {
    if (!scroll.current || !messageCount) return;
    if (follow.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    else setNewMessages(true);
  }, [messageCount]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const device = scroll.current?.closest<HTMLElement>(".album-device");
      if (device)
        device.style.maxHeight = `${viewport?.height || window.innerHeight}px`;
    };
    viewport?.addEventListener("resize", update);
    update();
    return () => {
      viewport?.removeEventListener("resize", update);
      const device = scroll.current?.closest<HTMLElement>(".album-device");
      if (device) device.style.maxHeight = "";
    };
  }, []);
  async function execute(id: string, turnId: string) {
    setBusy(true);
    try {
      adopt(
        await creationApi<CreationDraft>(
          `/api/creation/drafts/${id}/turns/${turnId}/execute`,
          {},
        ),
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh(id).catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!draft || transport.current || processing || turn || !text.trim())
      return;
    transport.current = true;
    setError("");
    setBusy(true);
    const value = text.trim();
    unsent.current =
      unsent.current?.text === value
        ? unsent.current
        : { id: crypto.randomUUID(), text: value };
    try {
      const received = await creationApi<{
        draft: CreationDraft;
        turnId: string;
      }>(`/api/creation/drafts/${draft.id}/messages`, {
        clientMessageId: unsent.current.id,
        expectedRevision: draft.revision,
        text: value,
      });
      adopt(received.draft);
      setText((current) => (current.trim() === value ? "" : current));
      unsent.current = null;
      await execute(draft.id, received.turnId);
    } catch (e) {
      setError((e as Error).message);
      const restored = await refresh(draft.id).catch(() => null);
      if (
        restored?.messages.some((m) => m.clientMessageId === unsent.current?.id)
      ) {
        setText((current) => (current.trim() === value ? "" : current));
        unsent.current = null;
      }
    } finally {
      transport.current = false;
      setBusy(false);
    }
  }
  async function upload(files: File[]) {
    if (!draft || uploading || !files.length) return;
    const base = draft;
    if (
      (!uploadRetry.current && base.photos.length + files.length > 9) ||
      files.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          !f.size ||
          f.size > 10 * 1024 * 1024,
      ) ||
      (!uploadRetry.current &&
        base.photos.reduce((n, p) => n + p.bytes, 0) +
          files.reduce((n, f) => n + f.size, 0) >
          50 * 1024 * 1024)
    ) {
      setError(
        "请选择 JPEG、PNG 或 WebP：最多 9 张，单张 10 MiB，总计 50 MiB。",
      );
      return;
    }
    const input = uploadRetry.current || {
      requestId: crypto.randomUUID(),
      files,
      ids: files.map(() => crypto.randomUUID()),
      previous: base.photos.map((p) => p.id),
    };
    uploadRetry.current = input;
    setUploading(true);
    setError("");
    try {
      const prepared = await creationApi<{
        draft: CreationDraft;
        photos: { id: string; path: string; token: string }[];
      }>(`/api/creation/drafts/${base.id}/photos`, {
        action: "prepare",
        requestId: input.requestId,
        expectedRevision: base.revision,
        files: input.files.map((f, i) => ({
          clientPhotoId: input.ids[i],
          name: f.name,
          mime: f.type,
          bytes: f.size,
        })),
      });
      adopt(prepared.draft);
      const storage = createClient().storage.from(CREATION_BUCKET);
      for (let i = 0; i < input.files.length; i++) {
        const p = prepared.photos[i];
        const result = await storage.uploadToSignedUrl(
          p.path,
          p.token,
          input.files[i],
          { contentType: input.files[i].type },
        );
        if (
          result.error &&
          !/already exists|duplicate/i.test(result.error.message)
        )
          throw new Error("照片上传失败，点击重试上传。");
      }
      const latest = await refresh(base.id);
      const currentIds = latest.photos.map((p) => p.id);
      const alreadyCommitted = input.ids.every((id) => currentIds.includes(id));
      if (
        !alreadyCommitted &&
        JSON.stringify(currentIds) !== JSON.stringify(input.previous)
      ) {
        uploadRetry.current = null;
        throw new Error("照片已在另一处更新，请重新选择要添加的照片。");
      }
      const committed = await creationApi<{
        draft: CreationDraft;
        turnId: string | null;
      }>(`/api/creation/drafts/${base.id}/photos`, {
        action: "commit",
        requestId: input.requestId,
        expectedRevision: latest.revision,
        photoIds: [...input.previous, ...input.ids],
      });
      adopt(committed.draft);
      uploadRetry.current = null;
      setUploading(false);
      if (committed.turnId) await execute(base.id, committed.turnId);
    } catch (e) {
      setError((e as Error).message);
      await refresh(base.id).catch(() => {});
    } finally {
      setUploading(false);
    }
  }
  async function remove(id: string) {
    if (!draft || uploading) return;
    setUploading(true);
    setError("");
    try {
      const next = await creationApi<{
        draft: CreationDraft;
        turnId: string | null;
      }>(`/api/creation/drafts/${draft.id}/photos`, {
        action: "commit",
        requestId: crypto.randomUUID(),
        expectedRevision: draft.revision,
        photoIds: draft.photos.filter((p) => p.id !== id).map((p) => p.id),
      });
      adopt(next.draft);
      setUploading(false);
      if (next.turnId) await execute(draft.id, next.turnId);
    } catch (e) {
      setError((e as Error).message);
      await refresh(draft.id).catch(() => {});
    } finally {
      setUploading(false);
    }
  }
  async function confirmCard(card: DirectionCard) {
    if (!draft || transport.current || processing || uploading || text.trim()) {
      if (text.trim()) setError("先发送或清空尚未发送的内容，再确认音乐方向。");
      return;
    }
    transport.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await creationApi<{ draftId: string; snapshotId: string }>(
        `/api/creation/drafts/${draft.id}/confirm`,
        {
          requestId: crypto.randomUUID(),
          cardId: card.id,
          expectedRevision: draft.revision,
          messageRevision: draft.messageRevision,
          photoRevision: draft.photoRevision,
        },
      );
      confirm(await snapshotInput(result.draftId, result.snapshotId));
      router.push(
        `/result?draft=${result.draftId}&snapshot=${result.snapshotId}`,
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh(draft.id).catch(() => {});
    } finally {
      transport.current = false;
      setBusy(false);
    }
  }
  const understanding = Boolean(draft?.messages.length);
  const examples = ["travel", "graduation", "cat", "garden", "sunset", "vinyl"];
  const images = draft?.photos.length
    ? draft.photos
    : understanding
      ? []
      : examples.map((name) => ({ id: name, url: photo(name) }));
  return (
    <AppShell>
      <main
        className={`album-screen screen-${understanding ? 3 : 2} creation-screen`}
        data-screen={understanding ? "03" : "02"}
        aria-label="创建音乐相册 · 连续对话"
      >
        <PageFrame title="创建音乐相册" backHref="/" />
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label="选择照片"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            uploadRetry.current = null;
            void upload(files);
          }}
        />
        <div
          className="creation-scroll"
          ref={scroll}
          onScroll={() => {
            if (!scroll.current) return;
            follow.current =
              scroll.current.scrollHeight -
                scroll.current.scrollTop -
                scroll.current.clientHeight <
              60;
            if (follow.current) setNewMessages(false);
          }}
        >
          <div
            className={`photo-stack stack-${understanding ? "understanding" : "upload"} creation-photos`}
          >
            {images.slice(0, understanding ? 5 : 6).map((p, i) => (
              <div className={`stack-photo stack-photo-${i + 1}`} key={p.id}>
                {/* biome-ignore lint/performance/noImgElement: Private images require current cookie authorization */}
                <img
                  src={p.url}
                  alt={draft?.photos.length ? `已选照片 ${i + 1}` : "照片示意"}
                />
              </div>
            ))}
            {!understanding && (
              <button
                type="button"
                className="add-photo glass"
                aria-label="添加照片"
                disabled={!draft || uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Plus />
                <span>{draft?.photos.length || 0}/9 张</span>
              </button>
            )}
          </div>
          {!understanding && (
            <div className="upload-caption">
              <h2>上传 1–9 张照片</h2>
              <p>让 AI 帮你把回忆变成一首歌</p>
            </div>
          )}
          {understanding && (
            <div className="creation-tools">
              <span className="understanding-status glass" role="status">
                <Sparkles />
                {uploading
                  ? "正在上传照片…"
                  : processing
                    ? "正在理解你的照片…"
                    : turn
                      ? "本轮需要重试"
                      : "一起聊聊这段记忆"}
              </span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setManager(true)}
              >
                管理 {draft?.photos.length || 0} 张照片
              </button>
            </div>
          )}
          {draft ? (
            <CreationDialogue
              draft={draft}
              busy={processing || uploading}
              onConfirm={(c) => void confirmCard(c)}
              onRetry={(id) => {
                setError("");
                void execute(draft.id, id);
              }}
            />
          ) : (
            <p className="creation-loading" role="status">
              {error ? "当前对话无法恢复" : "正在恢复对话…"}
            </p>
          )}
          {error && (
            <div className="creation-notice" role="alert">
              <p>{error}</p>
              {uploadRetry.current && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void upload(uploadRetry.current?.files || [])}
                >
                  重试上传
                </button>
              )}
              {!draft && (
                <button type="button" onClick={() => window.location.reload()}>
                  重试恢复
                </button>
              )}
              {!draft && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("music-creation-draft");
                    window.location.href = "/create?new=1";
                  }}
                >
                  创建新相册
                </button>
              )}
              {draft && (
                <button
                  type="button"
                  onClick={() =>
                    void refresh(draft.id)
                      .then(() => setError(""))
                      .catch((e: Error) => setError(e.message))
                  }
                >
                  重新读取
                </button>
              )}
            </div>
          )}
          {draft?.source === "demo" && (
            <p className="creation-source">当前为明确标识的 Agent 演示模式</p>
          )}
        </div>
        {newMessages && (
          <button
            type="button"
            className="creation-new-messages"
            onClick={() => {
              if (scroll.current)
                scroll.current.scrollTop = scroll.current.scrollHeight;
              follow.current = true;
              setNewMessages(false);
            }}
          >
            查看新消息 ↓
          </button>
        )}
        <div className="composer glass">
          <button
            type="button"
            className="composer-add"
            disabled={!draft || uploading}
            aria-label="继续上传"
            onClick={() => fileInput.current?.click()}
          >
            <Plus />
          </button>
          <input
            aria-label="和我聊聊这组照片"
            placeholder={
              understanding ? "继续聊聊这段记忆…" : "和我聊聊这组照片…"
            }
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void send();
            }}
          />
          <button
            type="button"
            className="composer-send dark"
            aria-label="发送消息"
            disabled={
              !draft || processing || uploading || Boolean(turn) || !text.trim()
            }
            onClick={() => void send()}
          >
            <ArrowUp />
          </button>
        </div>
        {manager && (
          <section
            className="flow-photo-manager glass creation-photo-manager"
            aria-label="管理已选照片"
          >
            <div className="flow-photo-manager-head">
              <strong>已选照片 · {draft?.photos.length || 0}/9</strong>
              <button type="button" onClick={() => setManager(false)}>
                完成
              </button>
            </div>
            <div className="flow-photo-manager-grid">
              {draft?.photos.map((p, i) => (
                <div key={p.id}>
                  {/* biome-ignore lint/performance/noImgElement: Private photo route validates ownership */}
                  <img src={p.url} alt={`第 ${i + 1} 张照片`} />
                  <button
                    type="button"
                    disabled={uploading}
                    aria-label={`删除第 ${i + 1} 张照片`}
                    onClick={() => void remove(p.id)}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              添加照片
            </button>
          </section>
        )}
      </main>
    </AppShell>
  );
}

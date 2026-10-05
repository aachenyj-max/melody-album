"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUp,
  ChevronRight,
  GraduationCap,
  Music2,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { photo } from "./demo-data";
import { MemoryProfileCard } from "./memory-profile-card";
import { useCreationSession } from "./creation-session";
import {
  prepareAnalysisFiles,
  validateSources,
  type PhotoInput,
} from "./photo-preparation";
import {
  normalizeProfile,
  type CreationPhase,
  type MemoryFailure,
  type MemoryProfile,
  type MemorySuccess,
} from "@/lib/memory/contract";

const sampleUpload = [
  "travel",
  "graduation",
  "cat",
  "garden",
  "sunset",
  "vinyl",
];
const sampleUnderstanding = [
  "garden",
  "graduation-wide",
  "graduation",
  "travel",
  "vinyl",
];
const suggestions = [
  "更快乐一点",
  "这是毕业，不是旅行",
  "少一点伤感",
  "加一些朋友的热闹感",
];

export function CreateFlow() {
  const router = useRouter();
  const pathname = usePathname();
  const { confirm } = useCreationSession();
  const [photos, setPhotos] = useState<PhotoInput[]>([]);
  const [story, setStory] = useState("");
  const [instruction, setInstruction] = useState("");
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [phase, setPhase] = useState<CreationPhase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [showUnderstanding, setShowUnderstanding] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoInput[]>([]);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastKind = useRef<"understand" | "revise">("understand");
  const analysisFiles = useRef<File[]>([]);
  const submitting = useRef(false);

  const invalidate = useCallback(() => {
    sequence.current += 1;
    controller.current?.abort();
    controller.current = null;
    analysisFiles.current = [];
    for (const item of photosRef.current) item.analysisFile = null;
    setProfile(null);
    setError("");
    setPhase(photosRef.current.length ? "selected" : "idle");
    submitting.current = false;
  }, []);

  const clearDraft = useCallback(() => {
    invalidate();
    for (const item of photosRef.current) URL.revokeObjectURL(item.previewUrl);
    photosRef.current = [];
    setPhotos([]);
    setStory("");
    setInstruction("");
    setShowUnderstanding(false);
    setShowPhotoManager(false);
  }, [invalidate]);

  useEffect(() => {
    if (pathname !== "/create") clearDraft();
  }, [pathname, clearDraft]);
  useEffect(
    () => () => {
      controller.current?.abort();
      for (const item of photosRef.current)
        URL.revokeObjectURL(item.previewUrl);
      photosRef.current = [];
    },
    [],
  );

  function chooseFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const problem = validateSources(photosRef.current, incoming);
    if (problem) {
      setError(problem);
      setPhase("invalid");
      return;
    }
    const appended = incoming.map(
      (file, index): PhotoInput => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        analysisFile: null,
        position: photosRef.current.length + index,
        readState: "ready",
      }),
    );
    photosRef.current = [...photosRef.current, ...appended];
    setPhotos(photosRef.current);
    invalidate();
  }

  function removePhoto(localId: string) {
    const target = photosRef.current.find((item) => item.localId === localId);
    if (target) URL.revokeObjectURL(target.previewUrl);
    photosRef.current = photosRef.current
      .filter((item) => item.localId !== localId)
      .map((item, position) => ({ ...item, position, analysisFile: null }));
    setPhotos(photosRef.current);
    invalidate();
    if (showUnderstanding) {
      setShowUnderstanding(false);
      window.history.replaceState(null, "", "/create");
    }
  }

  function badPreview(localId: string) {
    photosRef.current = photosRef.current.map((item) =>
      item.localId === localId ? { ...item, readState: "failed" } : item,
    );
    setPhotos(photosRef.current);
    invalidate();
    setError("有照片无法读取，请移除或更换。");
    setPhase("invalid");
  }

  function setStoryValue(value: string) {
    setStory(value);
    if (profile || analysisFiles.current.length) invalidate();
    if (value.trim().length > 1000) {
      setError("故事最多 1000 字。");
      setPhase("invalid");
    }
  }

  function returnToUpload() {
    sequence.current += 1;
    controller.current?.abort();
    setShowUnderstanding(false);
    setShowPhotoManager(false);
    setPhase(photosRef.current.length ? "selected" : "idle");
    setError("");
    window.history.replaceState(null, "", "/create");
    submitting.current = false;
  }

  async function submit(kind: "understand" | "revise") {
    if (submitting.current) return;
    if (photosRef.current.length < 1 || photosRef.current.length > 9) {
      setError("请选择 1–9 张照片。");
      setPhase("invalid");
      return;
    }
    if (photosRef.current.some((item) => item.readState === "failed")) {
      setError("有照片无法读取，请移除或更换。");
      setPhase("invalid");
      return;
    }
    if (story.trim().length > 1000) {
      setError("故事最多 1000 字。");
      setPhase("invalid");
      return;
    }
    const trimmed = instruction.trim();
    if (kind === "revise" && (trimmed.length < 1 || trimmed.length > 300)) {
      setError("请输入 1–300 字的修正内容。");
      return;
    }
    if (kind === "revise" && !profile) return;
    submitting.current = true;
    lastKind.current = kind;
    const token = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setProgress("正在准备照片…");
    setPhase(kind === "understand" ? "understanding" : "revising");
    if (kind === "understand") {
      setShowUnderstanding(true);
      setShowPhotoManager(false);
      window.history.pushState(null, "", "/create?state=understanding");
    }
    try {
      const profileJson =
        kind === "revise" ? JSON.stringify(profile) : undefined;
      const files = await prepareAnalysisFiles(
        photosRef.current,
        story.trim(),
        profileJson,
        kind === "revise" ? trimmed : undefined,
      );
      if (token !== sequence.current) return;
      analysisFiles.current = files;
      const form = new FormData();
      for (const file of files) form.append("photos", file);
      form.set("story", story.trim());
      if (kind === "revise") {
        form.set("profile", profileJson ?? "");
        form.set("baseVersion", String(profile?.version));
        form.set("instruction", trimmed);
      }
      setProgress(kind === "revise" ? "正在修正理解…" : "正在理解你的照片…");
      const response = await fetch(`/api/memory/${kind}`, {
        method: "POST",
        body: form,
        signal: abort.signal,
        cache: "no-store",
      });
      const data = (await response.json()) as MemorySuccess | MemoryFailure;
      if (token !== sequence.current) return;
      if (!response.ok || !("profile" in data)) {
        const message =
          "error" in data ? data.error.message : "暂时无法处理，请重试。";
        throw new Error(message);
      }
      const valid = normalizeProfile(data.profile, photosRef.current.length);
      if (
        !valid ||
        (kind === "understand" && valid.version !== 1) ||
        (kind === "revise" && valid.version !== (profile?.version ?? 0) + 1)
      )
        throw new Error("理解结果不可用，请重新尝试。");
      setProfile(valid);
      setInstruction("");
      setPhase("ready");
    } catch (caught) {
      if (token !== sequence.current || abort.signal.aborted) return;
      setError(
        caught instanceof Error ? caught.message : "暂时无法处理，请重试。",
      );
      setPhase("failed");
    } finally {
      if (token === sequence.current) {
        submitting.current = false;
        controller.current = null;
      }
    }
  }

  function confirmCurrent() {
    if (
      !profile ||
      !normalizeProfile(profile, photosRef.current.length) ||
      submitting.current
    )
      return;
    submitting.current = true;
    setPhase("confirmed");
    confirm({ profile, photos: photosRef.current.map((item) => item.file) });
    router.push("/result");
  }

  const busy =
    phase === "understanding" || phase === "revising" || phase === "confirmed";
  const sample = showUnderstanding ? sampleUnderstanding : sampleUpload;
  const visiblePhotos = photos.length
    ? photos
    : sample.map((name, position) => ({
        localId: name,
        previewUrl: photo(name),
        position,
      }));
  return (
    <AppShell>
      <main
        className={`album-screen screen-${showUnderstanding ? 3 : 2}`}
        data-screen={showUnderstanding ? "03" : "02"}
        aria-label={
          showUnderstanding
            ? "创建音乐相册 · Agent记忆理解"
            : "创建音乐相册 · 上传照片"
        }
      >
        <PageFrame title="创建音乐相册" backHref="/" />
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label="选择照片"
          onChange={(event) => {
            chooseFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div
          className={`photo-stack stack-${showUnderstanding ? "understanding" : "upload"}`}
        >
          {visiblePhotos
            .slice(0, showUnderstanding ? 5 : 6)
            .map((item, index) => (
              <div
                className={`stack-photo stack-photo-${index + 1} flow-photo`}
                key={item.localId}
              >
                {/* Dynamic object URLs cannot be optimized by Next Image. */}
                {/* biome-ignore lint/performance/noImgElement: Local object URLs are ephemeral */}
                <img
                  src={item.previewUrl}
                  alt={photos.length ? `已选照片 ${index + 1}` : "照片示意"}
                  onError={
                    photos.length ? () => badPreview(item.localId) : undefined
                  }
                />
                {photos.length > 0 && !busy && !showUnderstanding && (
                  <button
                    type="button"
                    aria-label={`删除第 ${index + 1} 张照片`}
                    className="flow-photo-remove"
                    onClick={() => removePhoto(item.localId)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          {!showUnderstanding && (
            <button
              type="button"
              className="add-photo glass"
              onClick={() => fileInput.current?.click()}
              aria-label="添加照片"
              disabled={busy}
            >
              <Plus />
              <span>{photos.length}/9 张</span>
            </button>
          )}
        </div>
        {showUnderstanding ? (
          <>
            <div className="understanding-status glass" role="status">
              <Sparkles />
              {busy
                ? progress
                : phase === "failed"
                  ? "处理失败，可重试"
                  : profile
                    ? `已理解 · 第 ${profile.version} 版`
                    : "正在理解你的照片…"}
            </div>
            {photos.length > 0 && (
              <button
                type="button"
                className="flow-manage-trigger"
                onClick={() => setShowPhotoManager(true)}
                disabled={busy}
              >
                管理 {photos.length} 张照片
              </button>
            )}
            <div className="agent-message understanding-message">
              <span className="agent-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass">
                {profile ? (
                  <>
                    <p>
                      {profile.event ??
                        profile.atmosphere ??
                        "这段回忆有待补充。"}
                    </p>
                    <MemoryProfileCard
                      profile={profile}
                      photoCount={photos.length}
                    />
                  </>
                ) : (
                  <p>
                    {busy
                      ? progress
                      : "还没有可用的理解结果，可以重试或返回修改照片。"}
                  </p>
                )}
              </div>
            </div>
            {profile && (
              <div className="event-title glass">
                <span>
                  <GraduationCap />
                </span>
                <strong>{profile.title}</strong>
                {profile.source === "demo" && (
                  <small className="flow-source">演示结果</small>
                )}
                <button
                  type="button"
                  aria-label="可通过下方输入修正标题"
                  disabled
                >
                  <Pencil />
                </button>
              </div>
            )}
            <div className="agent-message confirm-message">
              <span className="agent-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass">
                {profile
                  ? "这样的理解对吗？你也可以告诉我…"
                  : "请等待理解结果，或返回修改照片。"}
              </div>
            </div>
            <div className="understanding-suggestions">
              {suggestions.map((label) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => setInstruction(label)}
                  disabled={!profile || busy}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="composer glass">
              <button
                type="button"
                className="composer-add"
                onClick={returnToUpload}
                aria-label="返回修改照片"
              >
                <Plus />
              </button>
              <input
                aria-label="修正记忆理解"
                placeholder="继续补充或直接确认…"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                disabled={!profile || busy}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit("revise");
                }}
              />
              {instruction.trim() ? (
                <button
                  type="button"
                  className="composer-send dark"
                  onClick={() => void submit("revise")}
                  disabled={!profile || busy}
                  aria-label="发送修正指令"
                >
                  <ArrowUp />
                </button>
              ) : (
                <button
                  type="button"
                  className="composer-confirm dark"
                  onClick={confirmCurrent}
                  disabled={!profile || busy}
                >
                  一键确认，开始生成
                  <ChevronRight />
                </button>
              )}
            </div>
            {phase === "failed" && (
              <button
                type="button"
                className="flow-retry"
                onClick={() => void submit(lastKind.current)}
              >
                {lastKind.current === "revise" ? "重试修正" : "重试理解"}
              </button>
            )}
            {profile && instruction.trim() && !busy && (
              <button
                type="button"
                className="flow-confirm-previous"
                onClick={confirmCurrent}
              >
                确认当前第 {profile.version} 版
              </button>
            )}
          </>
        ) : (
          <>
            <div className="upload-caption">
              <h2>上传 1–9 张照片</h2>
              <p>让 AI 帮你把回忆变成一首歌</p>
              {photos.length > 6 && (
                <button
                  type="button"
                  className="flow-manage-inline"
                  onClick={() => setShowPhotoManager(true)}
                >
                  管理全部 {photos.length} 张
                </button>
              )}
            </div>
            <div className="agent-message upload-message-one">
              <span className="agent-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass">
                发给我一组照片，我会先理解
                <br />
                这段回忆，再帮你生成音乐。
              </div>
            </div>
            <div className="agent-message user-message upload-user">
              <span className="agent-avatar user-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass">
                {story.trim() ||
                  "你可以补充这段回忆的故事，让理解更贴近你的感受。"}
              </div>
            </div>
            <div className="agent-message upload-message-two">
              <span className="agent-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass">
                {photos.length
                  ? `已选择 ${photos.length} 张照片。还可以告诉我一些细节，或者直接开始理解。`
                  : "太好了！这些照片充满了青春的故事。你还可以告诉我一些细节，比如想要的音乐风格、氛围，或者这段回忆的关键词，我会为你量身创作。"}
              </div>
            </div>
            <div className="composer glass">
              <button
                type="button"
                className="composer-add"
                onClick={() => fileInput.current?.click()}
                aria-label="继续上传"
              >
                <Plus />
              </button>
              <input
                aria-label="和我聊聊这组照片"
                placeholder="和我聊聊这组照片…"
                value={story}
                onChange={(event) => setStoryValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit("understand");
                }}
              />
              <button
                type="button"
                className="composer-send dark"
                aria-label="开始理解照片"
                onClick={() => void submit("understand")}
                disabled={busy}
              >
                <ArrowUp />
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="flow-error" role="alert">
            {error}
          </div>
        )}
        {showPhotoManager && (
          <section
            className="flow-photo-manager glass"
            aria-label="管理已选照片"
          >
            <div className="flow-photo-manager-head">
              <strong>已选照片 · {photos.length}/9</strong>
              <button type="button" onClick={() => setShowPhotoManager(false)}>
                完成
              </button>
            </div>
            <div className="flow-photo-manager-grid">
              {photos.map((item, index) => (
                <div key={item.localId}>
                  {/* biome-ignore lint/performance/noImgElement: Local object URLs are ephemeral */}
                  <img src={item.previewUrl} alt={`第 ${index + 1} 张照片`} />
                  <button
                    type="button"
                    onClick={() => removePhoto(item.localId)}
                    aria-label={`删除第 ${index + 1} 张照片`}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

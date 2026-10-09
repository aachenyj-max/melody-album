"use client";

import { Ellipsis, Play, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BottomNav } from "./bottom-nav";
import type { DemoMemoryAlbum } from "./demo-data";
import { changeDemoAlbum } from "./demo-library";
import { PageFrame } from "./page-frame";

export function MemoriesScreen({
  albums,
  loading = false,
  error,
  onRetry,
  justSaved,
}: {
  albums: DemoMemoryAlbum[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  justSaved?: string | null;
}) {
  const [category, setCategory] = useState("全部");
  const [menu, setMenu] = useState<string | null>(null);
  const [action, setAction] = useState<{
    album: DemoMemoryAlbum;
    kind: "edit" | "delete";
  } | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = albums.filter(
    (album) => category === "全部" || album.category === category,
  );

  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".memory-actions")
      )
        setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  function openAction(album: DemoMemoryAlbum, kind: "edit" | "delete") {
    setTitle(album.title);
    setCaption(album.caption);
    setActionError(null);
    setMenu(null);
    setAction({ album, kind });
  }

  async function submit() {
    if (!action || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action.album.id.startsWith("demo-")) {
        changeDemoAlbum(
          action.album.id,
          action.kind === "delete"
            ? null
            : { title: title.trim(), caption: caption.trim() },
        );
      } else {
        const response = await fetch(
          `/api/albums/${encodeURIComponent(action.album.id)}`,
          {
            method: action.kind === "delete" ? "DELETE" : "PATCH",
            headers: { "content-type": "application/json" },
            ...(action.kind === "edit"
              ? {
                  body: JSON.stringify({
                    title: title.trim(),
                    caption: caption.trim(),
                  }),
                }
              : {}),
          },
        );
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error ?? "操作失败，请重试。");
        }
      }
      setAction(null);
      onRetry?.();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "操作失败，请重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageFrame title="我的音乐记忆" large />
      <div className="memory-filters">
        {["全部", "旅行", "生活", "宠物", "其他"].map((label) => (
          <button
            key={label}
            type="button"
            className={category === label ? "selected" : ""}
            onClick={() => {
              setCategory(label);
              setMenu(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="memory-list">
        {error && (
          <div className="memory-read-notice" role="alert">
            {error}{" "}
            <button type="button" onClick={onRetry}>
              重试
            </button>
          </div>
        )}
        {loading && albums.length === 0 && (
          <div className="memory-list-empty glass" role="status">
            正在读取音乐记忆…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="memory-list-empty glass">
            <strong>
              还没有{category === "全部" ? "音乐记忆" : `${category}相册`}
            </strong>
            <p>上传照片，让回忆拥有自己的声音。</p>
            <Link href="/create">创建音乐相册</Link>
          </div>
        )}
        {visible.map((album, index) => (
          <article className="memory-row glass" key={album.id}>
            <Link
              className="memory-row-link"
              href={`/memories/${album.id}`}
              aria-label={`查看${album.title}详情`}
            >
              <div className="memory-row-cover">
                <Image
                  src={album.coverImage}
                  alt={album.title}
                  fill
                  sizes="150px"
                  priority={index === 0}
                />
                <span className="tile-play glass">
                  <Play fill="currentColor" />
                </span>
              </div>
              <div className="memory-row-info">
                <h2>
                  {album.title}
                  {justSaved === album.id ? " · 已保存" : ""}
                </h2>
                <p>
                  {album.photoCount} 张照片 · {album.trackCount} 首音乐
                </p>
                <p>{album.subtitle}</p>
                <time>
                  {album.createdAt
                    ? album.createdAt.replaceAll("-", ".")
                    : "日期待补充"}
                </time>
              </div>
            </Link>
            <div className="memory-actions">
              <button
                type="button"
                className="memory-row-more"
                aria-label={`管理${album.title}`}
                aria-expanded={menu === album.id}
                aria-controls={`actions-${album.id}`}
                onClick={() => setMenu(menu === album.id ? null : album.id)}
              >
                <Ellipsis aria-hidden="true" />
              </button>
              {menu === album.id && (
                <div id={`actions-${album.id}`} className="memory-action-menu">
                  <button
                    type="button"
                    onClick={() => openAction(album, "edit")}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => openAction(album, "delete")}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <BottomNav />
      <dialog
        ref={dialog}
        className="memory-edit-dialog"
        aria-labelledby="album-action-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setAction(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <button
            type="button"
            className="memory-dialog-close"
            disabled={busy}
            aria-label="关闭"
            onClick={() => setAction(null)}
          >
            <X />
          </button>
          <h2 id="album-action-title">
            {action?.kind === "delete" ? "删除音乐相册" : "编辑音乐相册"}
          </h2>
          {action?.kind === "delete" ? (
            <p>
              确定删除“{action.album.title}”吗？
              {action.album.id.startsWith("demo-")
                ? "这张演示相册将从当前浏览器移除。"
                : "相册与照片将被删除，无法恢复。"}
            </p>
          ) : (
            <>
              <label>
                相册名称
                <input
                  required
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                一句话记忆
                <textarea
                  maxLength={300}
                  rows={3}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  disabled={busy}
                />
              </label>
            </>
          )}
          {actionError && (
            <p role="alert" className="danger">
              {actionError}
            </p>
          )}
          <div className="memory-dialog-buttons">
            <button
              type="button"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              取消
            </button>
            <button
              type="submit"
              className={action?.kind === "delete" ? "delete-confirm" : "dark"}
              disabled={busy || (action?.kind === "edit" && !title.trim())}
            >
              {busy
                ? "处理中…"
                : action?.kind === "delete"
                  ? "确认删除"
                  : "保存修改"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

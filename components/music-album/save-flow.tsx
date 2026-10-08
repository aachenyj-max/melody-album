"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Pencil,
  Quote,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ALBUM_BUCKET } from "@/lib/albums/contract";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { useMusicSession } from "./music-session";

export function SaveFlow() {
  const router = useRouter();
  const music = useMusicSession();
  const confirmed = music.confirmed;
  const run = music.run;
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState(confirmed?.profile.title ?? "");
  const [eventMonth, setEventMonth] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState("正在保存…");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!confirmed) return;
    const urls = confirmed.profile.photoOrder.map((index) =>
      URL.createObjectURL(confirmed.photos[index]),
    );
    setPhotos(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [confirmed]);

  useEffect(() => {
    music.pause();
  }, [music.pause]);

  const selected =
    run?.selection.kind === "qq"
      ? run.recommendations.tracks.find(
          (item) =>
            item.id ===
              (run.selection.kind === "qq" ? run.selection.trackId : "") &&
            item.playable,
        )
      : (run?.adjustedTrack ?? run?.ai.track);
  const sourceText =
    run?.selection.kind === "qq"
      ? "QQ 音乐演示推荐"
      : selected?.source === "demo"
        ? "AI 演示配乐"
        : "AI 原创配乐";

  function changed() {
    requestId.current = crypto.randomUUID();
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !confirmed || !run || !selected?.audioUrl) return;
    if (!title.trim() || title.trim().length > 80) {
      setError("标题需为 1–80 字。");
      return;
    }
    if (caption.trim().length > 300) {
      setError("一句话记忆不能超过 300 字。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const session = await fetch("/api/albums/session", {
        method: "POST",
        cache: "no-store",
      });
      if (!session.ok)
        throw new Error(
          (await session.json()).error ?? "暂时无法建立保存会话。",
        );
      const snapshot = {
        contractVersion: 1,
        requestId: requestId.current,
        title: title.trim(),
        eventDate: eventMonth ? `${eventMonth}-01` : null,
        caption: caption.trim(),
        memory: confirmed.profile,
        music: run,
      };
      const orderedFiles = confirmed.profile.photoOrder.map(
        (index) => confirmed.photos[index],
      );
      const manifest = [];
      for (const [position, file] of orderedFiles.entries()) {
        setSavingLabel(`正在准备照片 ${position + 1}/${orderedFiles.length}…`);
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await file.arrayBuffer(),
        );
        manifest.push({
          position,
          originalName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          sha256: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        });
      }
      setSavingLabel("正在准备上传…");
      const intentResponse = await fetch("/api/albums/upload-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, photos: manifest }),
        cache: "no-store",
      });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) {
        if (intent.code === "UPLOAD_EXPIRED")
          requestId.current = crypto.randomUUID();
        throw new Error(intent.error ?? "暂时无法准备照片上传，请重试。 ");
      }
      if (!intent.alreadySaved) {
        const storage = createClient().storage.from(ALBUM_BUCKET);
        for (const item of intent.photos as Array<{
          position: number;
          path: string;
          uploaded: boolean;
          token?: string;
        }>) {
          if (item.uploaded) continue;
          const file = orderedFiles[item.position];
          if (!file || !item.token)
            throw new Error("照片上传资格无效，请重试。 ");
          setSavingLabel(
            `正在上传照片 ${item.position + 1}/${orderedFiles.length}…`,
          );
          const uploaded = await storage.uploadToSignedUrl(
            item.path,
            item.token,
            file,
            {
              contentType: file.type,
              cacheControl: "0",
            },
          );
          if (uploaded.error)
            throw new Error(`第 ${item.position + 1} 张照片上传失败，请重试。`);
        }
      }
      setSavingLabel("正在保存相册…");
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snapshot,
          photos: manifest,
          albumId: intent.albumId,
        }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "UPLOAD_EXPIRED")
          requestId.current = crypto.randomUUID();
        throw new Error(result.error ?? "保存暂时失败，请重试。");
      }
      music.stop();
      router.push(`/memories?justSaved=${result.albumId}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存暂时失败，请重试。",
      );
    } finally {
      setSaving(false);
      setSavingLabel("正在保存…");
    }
  }

  return (
    <AppShell>
      <main
        className="album-screen screen-7"
        data-screen="07"
        aria-label="保存音乐相册"
      >
        <PageFrame title="保存音乐相册" backHref="/play" />
        <div className="photo-stack stack-save">
          {photos.map((src, index) => (
            <Image
              key={src}
              src={src}
              alt={`本次记忆照片 ${index + 1}`}
              width={800}
              height={800}
              unoptimized
              className={`album-photo stack-photo stack-photo-${index + 1}`}
            />
          ))}
        </div>
        <form onSubmit={submit}>
          <section className="save-fields glass">
            <label className="save-title">
              <span>
                <GraduationCap />
              </span>
              <input
                aria-label="事件标题"
                value={title}
                maxLength={80}
                onChange={(e) => {
                  setTitle(e.target.value);
                  changed();
                }}
              />
              <Pencil />
            </label>
            <label className="save-date glass">
              <CalendarDays />
              <span>时间</span>
              <input
                aria-label="事件月份"
                type="month"
                value={eventMonth}
                onChange={(e) => {
                  setEventMonth(e.target.value);
                  changed();
                }}
              />
              <ChevronRight />
            </label>
            <p className="created-date">
              创建于{" "}
              {new Date().toISOString().slice(0, 10).replaceAll("-", ".")}
            </p>
            <div className="save-quote glass">
              <Quote />
              <span>
                {confirmed?.profile.event ??
                  confirmed?.profile.atmosphere ??
                  "这段记忆，值得珍藏。"}{" "}
                · {selected?.title ?? "音乐待选择"}（{sourceText}）
              </span>
            </div>
            <label className="save-caption glass">
              <Pencil />
              <textarea
                maxLength={300}
                aria-label="一句话记忆"
                placeholder="写下一句话，记录此刻的心情…"
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  changed();
                }}
              />
              <span>{caption.length}/300</span>
            </label>
          </section>
          {error && (
            <p role="alert" className="save-error">
              {error}
            </p>
          )}
          <button
            className="save-submit pill-button dark"
            type="submit"
            disabled={saving}
          >
            {saving ? savingLabel : "保存到我的音乐记忆"}
            <ArrowRight />
          </button>
        </form>
        <Link className="save-later" href="/play">
          稍后再说
        </Link>
      </main>
    </AppShell>
  );
}

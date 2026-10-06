"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Guitar,
  Music2,
  Play,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { useMusicSession } from "./music-session";

const suggestions = [
  { label: "再快一点", icon: Zap },
  { label: "多一点吉他", icon: Guitar },
  { label: "换一种风格", icon: Sparkles },
];

export function AdjustFlow() {
  const music = useMusicSession();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [photoSrc, setPhotoSrc] = useState<string>();
  const confirmed = music.confirmed;
  useEffect(() => {
    music.pause();
  }, [music.pause]);
  useEffect(() => {
    if (!confirmed) return;
    const url = URL.createObjectURL(
      confirmed.photos[confirmed.profile.photoOrder[0]],
    );
    setPhotoSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [confirmed]);
  const latest = music.adjustments.at(-1);
  const pending = latest?.status === "pending";
  const qqTrackId =
    music.run?.selection.kind === "qq" ? music.run.selection.trackId : null;
  const selected =
    music.run?.selection.kind === "qq"
      ? music.run.recommendations.tracks.find((item) => item.id === qqTrackId)
      : (music.run?.adjustedTrack ?? music.run?.ai.track);
  const title =
    music.run?.selection.kind === "qq"
      ? music.run.recommendations.tracks.find((item) => item.id === qqTrackId)
          ?.title
      : (music.run?.adjustedTrack?.title ?? music.run?.ai.track?.title);
  const source =
    music.run?.selection.kind === "qq"
      ? "QQ 音乐演示推荐"
      : music.run?.adjustedTrack?.source === "demo" ||
          music.run?.ai.source === "demo"
        ? "AI 演示配乐"
        : "AI 原创配乐";
  const send = (value: string) => {
    const instruction = value.trim();
    if (!instruction || instruction.length > 300 || pending) return;
    setInput("");
    void music.adjust(instruction);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(input);
  };
  const replay = () => {
    void music.replay();
    router.push("/play");
  };
  return (
    <AppShell>
      <main
        className="album-screen screen-6"
        data-screen="06"
        aria-label="调整音乐"
      >
        <PageFrame title="调整音乐" backHref="/play" />
        {!music.run || !confirmed || !photoSrc || !selected?.audioUrl ? (
          <div className="adjust-empty glass">
            <h2>还没有可调整的音乐</h2>
            <p>先在生成结果中选择可播放的音乐。</p>
            <Link href="/result">返回生成结果</Link>
          </div>
        ) : (
          <>
            {latest && (
              <div className="agent-message user-message adjust-user">
                <span className="agent-avatar user-avatar">
                  <Image
                    src={photoSrc}
                    alt=""
                    width={80}
                    height={80}
                    unoptimized
                  />
                </span>
                <div className="message-bubble glass">{latest.instruction}</div>
              </div>
            )}
            <div className="agent-message adjust-agent">
              <span className="agent-avatar">
                <Music2 />
              </span>
              <div className="message-bubble glass" role="status">
                {latest?.status === "pending"
                  ? "正在根据你的想法生成新音乐，原版本仍可播放…"
                  : (latest?.responseText ??
                    "想让这段音乐更像你的回忆吗？告诉我想调整的感觉。")}
              </div>
            </div>
            <Image
              src={photoSrc}
              alt={`${confirmed.profile.title}照片`}
              width={800}
              height={800}
              unoptimized
              className="album-photo adjust-cover"
            />
            <section className="music-card glass adjust-music-card">
              <h2>{title ?? "正在准备音乐"}</h2>
              <p>
                {source} ·{" "}
                {latest?.status === "pending"
                  ? "生成中"
                  : latest?.status === "failed"
                    ? "调整失败，保留原版"
                    : latest?.status === "succeeded"
                      ? "新版本可试听"
                      : "当前版本"}
              </p>
              <div className="waveform" aria-hidden="true">
                {Array.from(
                  { length: 34 },
                  (_, index) => 12 + ((index * 17) % 57),
                ).map((height) => (
                  <i key={height} style={{ height: `${height}%` }} />
                ))}
              </div>
              <button
                type="button"
                className="music-play dark"
                onClick={replay}
                aria-label={
                  latest?.status === "succeeded"
                    ? "重新播放新版本"
                    : "播放当前版本"
                }
              >
                <Play fill="currentColor" />
              </button>
            </section>
            {latest?.status === "failed" && (
              <button
                type="button"
                className="adjust-retry"
                onClick={() => send(latest.instruction)}
              >
                重试调整
              </button>
            )}
            {pending && (
              <button
                type="button"
                className="adjust-retry"
                onClick={music.cancelAdjustment}
              >
                取消调整
              </button>
            )}
            <div className="adjust-suggestions">
              {suggestions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  disabled={pending || !selected?.audioUrl}
                  onClick={() => send(label)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
            <form className="composer glass adjust-composer" onSubmit={submit}>
              <span className="composer-add" aria-hidden="true">
                <Plus />
              </span>
              <input
                aria-label="调整音乐的想法"
                placeholder="继续告诉我你的想法…"
                maxLength={300}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={pending}
              />
              <button
                type="submit"
                className="composer-send dark"
                aria-label="发送调整指令"
                disabled={!input.trim() || pending}
              >
                <ArrowUp />
              </button>
            </form>
          </>
        )}
      </main>
    </AppShell>
  );
}

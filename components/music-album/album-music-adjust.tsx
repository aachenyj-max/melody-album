"use client";

import { ArrowUp, Music2, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AlbumMusicCandidate } from "@/lib/albums/music-contract";
import { AppShell } from "./app-shell";
import type { DemoMemoryAlbum } from "./demo-data";
import { confirmDemoMusic } from "./demo-library";
import { PageFrame } from "./page-frame";

export function AlbumMusicAdjust({
  album,
  onSaved,
}: {
  album: DemoMemoryAlbum;
  onSaved: () => void;
}) {
  const router = useRouter();
  const current =
    album.tracks.find((track) => track.id === album.selectedTrackId) ??
    album.tracks[0];
  const [input, setInput] = useState("");
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidate, setCandidate] = useState<AlbumMusicCandidate | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const playingVersion = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const detailHref = `/memories/${album.id}`;

  useEffect(() => {
    const player = audio.current;
    return () => {
      request.current?.abort();
      player?.pause();
    };
  }, []);

  async function generate(value: string) {
    if (pending || saving || !current?.audioUrl || !value.trim()) return;
    audio.current?.pause();
    setPending(true);
    setCandidate(null);
    setPreviewed(false);
    setValid(false);
    setError(null);
    setInstruction(value.trim());
    setInput("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/albums/${album.id}/music`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction: value.trim(),
          baseTrackId: current.id,
        }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "生成失败，原音乐未变更。");
      if (
        !body.candidate?.track?.audioUrl ||
        body.candidate.track.source !== "api" ||
        body.candidate.baseTrackId !== current.id
      )
        throw new Error("新音乐结果无效，原音乐未变更。");
      if (!controller.signal.aborted) setCandidate(body.candidate);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "生成失败，原音乐未变更。",
        );
    } finally {
      if (request.current === controller) {
        setPending(false);
        request.current = null;
      }
    }
  }

  async function play(version: string, url: string) {
    const player = audio.current;
    if (!player) return;
    if (playingVersion.current === version && !player.paused) {
      player.pause();
      return;
    }
    player.pause();
    playingVersion.current = version;
    if (player.getAttribute("src") !== url) {
      player.src = url;
      player.load();
    }
    try {
      await player.play();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("音频暂时无法播放，请重试。原音乐未变更。");
      setValid(false);
    }
  }

  async function confirm() {
    if (!candidate || !previewed || !valid || saving) return;
    setSaving(true);
    setError(null);
    audio.current?.pause();
    try {
      if (album.id.startsWith("demo-")) confirmDemoMusic(album.id, candidate);
      else {
        const response = await fetch(`/api/albums/${album.id}/music`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            versionId: candidate.versionId,
            baseTrackId: candidate.baseTrackId,
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "保存失败，原音乐未变更。");
      }
      onSaved();
      router.replace(detailHref);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存失败，原音乐未变更。",
      );
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    request.current?.abort();
    request.current = null;
    setPending(false);
    audio.current?.pause();
    setCandidate(null);
    setPreviewed(false);
    setValid(false);
    setError(null);
  }

  return (
    <AppShell>
      <main
        className="album-screen screen-6 saved-album-adjust"
        data-screen="06"
        aria-label="修改相册音乐"
      >
        <PageFrame title="修改音乐" backHref={detailHref} />
        <audio
          ref={audio}
          preload="none"
          onPause={() => setPlaying(null)}
          onEnded={() => setPlaying(null)}
          onError={() => {
            setValid(false);
            setPlaying(null);
            setError("音频暂时无法播放，原音乐未变更。");
          }}
          onLoadedMetadata={() => {
            const player = audio.current;
            if (
              player &&
              candidate &&
              playingVersion.current === candidate.versionId
            ) {
              const playable =
                Number.isFinite(player.duration) &&
                player.duration >= 15 &&
                player.duration <= 35;
              setValid(playable);
              if (!playable)
                setError("新音乐时长无效，请重新生成。原音乐未变更。");
            }
          }}
          onPlaying={() => {
            setPlaying(playingVersion.current);
            if (candidate && playingVersion.current === candidate.versionId)
              setPreviewed(true);
          }}
        >
          <track
            kind="captions"
            srcLang="zh"
            label="音乐提示"
            src="/audio/music-album/music-captions.vtt"
          />
        </audio>
        <div className="saved-adjust-body">
          <div className="saved-adjust-conversation" role="status">
            {instruction && <p className="saved-adjust-user">{instruction}</p>}
            <p className="glass">
              <Music2 />
              {pending
                ? "正在生成新配乐，原音乐仍然保留…"
                : candidate
                  ? candidate.responseText
                  : "想让这段音乐更像你的回忆吗？告诉我想调整的感觉。"}
            </p>
          </div>
          <Image
            className="saved-adjust-cover"
            src={album.coverImage}
            alt={album.title}
            width={800}
            height={800}
            unoptimized
          />
          <section className="saved-adjust-track glass">
            <div>
              <h2>{current?.title ?? "暂无音乐"}</h2>
              <p>当前音乐 · {current?.duration}</p>
            </div>
            <button
              type="button"
              disabled={!current?.audioUrl || saving}
              onClick={() =>
                current?.audioUrl && void play(current.id, current.audioUrl)
              }
              aria-label={`${playing === current?.id ? "暂停" : "播放"}当前音乐`}
            >
              {playing === current?.id ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </button>
          </section>
          {candidate && (
            <section className="saved-adjust-track saved-adjust-candidate glass">
              <div>
                <h2>新版本</h2>
                <p>
                  {previewed && valid
                    ? "已试听，可以确认替换"
                    : "先试听，满意后再替换"}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void play(candidate.versionId, candidate.track.audioUrl)
                }
                aria-label={`${playing === candidate.versionId ? "暂停" : "试听"}新音乐`}
              >
                {playing === candidate.versionId ? (
                  <Pause fill="currentColor" />
                ) : (
                  <Play fill="currentColor" />
                )}
              </button>
            </section>
          )}
          {error && (
            <p className="saved-adjust-error" role="alert">
              {error}
            </p>
          )}
          {pending && (
            <button
              className="saved-adjust-cancel"
              type="button"
              onClick={discard}
            >
              取消生成
            </button>
          )}
          {candidate && (
            <div className="saved-adjust-confirm">
              <button type="button" disabled={saving} onClick={discard}>
                保留原音乐
              </button>
              <button
                type="button"
                className="dark"
                disabled={!previewed || !valid || saving}
                onClick={() => void confirm()}
              >
                {saving ? "保存中…" : "确认替换"}
              </button>
            </div>
          )}
        </div>
        <div className="saved-adjust-suggestions">
          {["再轻快一点", "多一点吉他", "温柔一点"].map((text) => (
            <button
              type="button"
              key={text}
              disabled={pending || saving}
              onClick={() => setInput(text)}
            >
              {text}
            </button>
          ))}
        </div>
        <form
          className="saved-adjust-composer glass"
          onSubmit={(event) => {
            event.preventDefault();
            void generate(input);
          }}
        >
          <input
            aria-label="音乐调整要求"
            placeholder="描述你想要的音乐感觉…"
            value={input}
            maxLength={300}
            disabled={pending || saving}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            className="dark"
            type="submit"
            aria-label="发送音乐调整要求"
            disabled={pending || saving || !input.trim()}
          >
            <ArrowUp />
          </button>
        </form>
      </main>
    </AppShell>
  );
}

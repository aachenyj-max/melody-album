"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DetailTrackPlayer({
  audioUrl,
  title,
}: {
  audioUrl: string;
  title: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const player = audio.current;
    return () => {
      player?.pause();
    };
  }, []);

  async function toggle() {
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError(false);
    try {
      await player.play();
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  return (
    <>
      <audio
        ref={audio}
        src={audioUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setError(true);
          setPlaying(false);
        }}
      >
        <track
          kind="captions"
          srcLang="zh"
          label="音乐提示"
          src="/audio/music-album/music-captions.vtt"
        />
      </audio>
      <button
        className="dark detail-play-placeholder"
        type="button"
        onClick={() => void toggle()}
        aria-label={`${playing ? "暂停" : error ? "重试播放" : "播放"}${title}`}
      >
        {playing ? (
          <Pause fill="currentColor" aria-hidden="true" />
        ) : (
          <Play fill="currentColor" aria-hidden="true" />
        )}
      </button>
      {error && (
        <span className="detail-audio-error" role="alert">
          音频暂不可播，请重试
        </span>
      )}
    </>
  );
}

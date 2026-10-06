"use client";

import Link from "next/link";
import { AlbumScreen } from "./album-screen";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { useMusicSession } from "./music-session";

export function SaveGate() {
  const music = useMusicSession();
  const run = music.run;
  const qqTrackId = run?.selection.kind === "qq" ? run.selection.trackId : null;
  const selected =
    run?.selection.kind === "qq"
      ? run.recommendations.tracks.find(
          (item) => item.id === qqTrackId && item.playable && item.audioUrl,
        )
      : (run?.adjustedTrack ?? run?.ai.track);
  if (
    music.confirmed &&
    run?.currentVersionId &&
    selected?.audioUrl &&
    music.audioState !== "failed"
  )
    return <AlbumScreen screen={7} />;
  return (
    <AppShell>
      <main
        className="album-screen screen-7"
        data-screen="07"
        aria-label="保存音乐相册"
      >
        <PageFrame title="保存音乐相册" backHref="/play" />
        <div className="adjust-empty glass">
          <h2>还没有可保存的音乐</h2>
          <p>等待专属配乐完成，或从结果页选择可播放的推荐。</p>
          <Link href="/result">返回生成结果</Link>
        </div>
      </main>
    </AppShell>
  );
}

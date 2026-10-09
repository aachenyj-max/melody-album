import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Ellipsis,
  GraduationCap,
  Heart,
  Moon,
  Music2,
  Pause,
  Pencil,
  Play,
  Quote,
  SkipBack,
  SkipForward,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, TouchEvent } from "react";
import { AdjustFlow } from "./adjust-flow";
import { AlbumPhotoGallery } from "./album-photo-gallery";
import { AppShell } from "./app-shell";
import { BottomNav } from "./bottom-nav";
import { CreateFlow } from "./create-flow";
import {
  type DemoMemoryAlbum,
  demoMemoryAlbums,
  demoRecentAiTrack,
  getRecentDemoMemoryAlbums,
  photo,
} from "./demo-data";
import { DetailTrackPlayer } from "./detail-track-player";
import { MemoriesScreen } from "./memories-screen";
import type { ResultViewModel } from "./music-session";
import { PageFrame } from "./page-frame";

function Photo({
  src,
  alt = "",
  className = "",
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={800}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      className={`album-photo ${className}`}
    />
  );
}

function PhotoStack({ kind }: { kind: "home" | "save" }) {
  const names =
    kind === "home"
      ? ["garden", "sunset", "vinyl"]
      : ["travel", "graduation", "cat", "garden", "sunset", "vinyl"];
  return (
    <div className={`photo-stack stack-${kind}`}>
      {names.map((name, index) => (
        <Photo
          key={name}
          src={photo(name)}
          alt={`记忆照片 ${index + 1}`}
          className={`stack-photo stack-photo-${index + 1}`}
          eager={kind === "home" && index === 1}
        />
      ))}
    </div>
  );
}

function MusicCard({
  title = "青春的回声",
  home = false,
}: {
  title?: string;
  home?: boolean;
}) {
  return (
    <div className={`music-card glass ${home ? "home-music-card" : ""}`}>
      <h2>{home ? demoRecentAiTrack.title : title}</h2>
      <p>
        {home
          ? `${demoRecentAiTrack.artist} · ${demoRecentAiTrack.duration}`
          : "AI 原创配乐 · 0:28"}
      </p>
      <p className="music-description">
        {home ? (
          <>
            把时光写成一首歌，
            <br />
            在路上与自己相遇。
          </>
        ) : (
          <>
            轻快的钢琴与吉他，
            <br />
            像是阳光下的告别，也像是新的开始。
          </>
        )}
      </p>
      <Link
        href={home ? "/create?new=1" : "/play"}
        className="music-play dark"
        aria-label="进入播放"
      >
        {home ? <Music2 /> : <Play fill="currentColor" />}
      </Link>
    </div>
  );
}

function MemoryTiles({
  recommendations = false,
}: {
  recommendations?: boolean;
}) {
  return (
    <div className="memory-tiles">
      {getRecentDemoMemoryAlbums()
        .slice(0, 3)
        .map((album, index) => (
          <div className="memory-tile" key={album.id}>
            <Link
              href={recommendations ? "/play" : `/memories/${album.id}`}
              className="tile-photo"
            >
              <Photo src={album.coverImage} alt={album.title} />
              <span className="tile-play glass">
                <Play fill="currentColor" />
              </span>
            </Link>
            <h3>
              {recommendations
                ? ["再见，昨天", "晴天", "是你"][index]
                : album.title}
              <Ellipsis />
            </h3>
            <p>
              {recommendations
                ? ["QQ音乐 · 3:12", "周杰伦 · 4:29", "告五人 · 3:45"][index]
                : `${album.tracks.find((track) => track.kind === "ai")?.title ?? "暂无音乐"} · ${album.createdAt || "日期待补充"}`}
            </p>
          </div>
        ))}
    </div>
  );
}

function HomeScreen() {
  return (
    <>
      <div className="home-profile">
        <h1>你的名字</h1>
        <p>摄影 · 音乐 · 旅行</p>
      </div>
      <PhotoStack kind="home" />
      <MusicCard home />
      <Link href="/create?new=1" className="home-create glass">
        生成音乐
        <span className="dark">
          <ChevronRight />
        </span>
      </Link>
      <p className="home-create-hint">上传照片，生成一段记忆</p>
      <section className="home-memories">
        <div className="section-title">
          <h2>我的音乐记忆</h2>
          <Link href="/memories">
            查看全部
            <ChevronRight />
          </Link>
        </div>
        {demoMemoryAlbums.length > 0 ? (
          <MemoryTiles />
        ) : (
          <p className="home-memory-empty">还没有音乐记忆，先创建一段吧。</p>
        )}
      </section>
      <BottomNav />
    </>
  );
}

function ResultScreen({
  photoSrc,
  confirmed = false,
  music,
  browseTab = "ai",
  onBrowseTab,
}: {
  photoSrc?: string;
  confirmed?: boolean;
  music?: ResultViewModel;
  browseTab?: "ai" | "qq";
  onBrowseTab?: (tab: "ai" | "qq") => void;
}) {
  const run = music?.run;
  const ai = run?.ai;
  const shownAiTrack = run?.adjustedTrack ?? ai?.track;
  const shownAiSource = run?.adjustedTrack?.source ?? ai?.source;
  const recommendations = run?.recommendations;
  const selectedQq =
    run?.selection.kind === "qq" ? run.selection.trackId : null;
  const selectedQqPlayable = recommendations?.tracks.some(
    (track) => track.id === selectedQq && track.playable,
  );
  const previewQq =
    recommendations?.tracks.find((item) => item.id === selectedQq) ??
    recommendations?.tracks.find((item) => item.playable) ??
    recommendations?.tracks[0];
  const canEnterPlay = Boolean(
    confirmed &&
      (selectedQqPlayable ||
        ai?.status === "ready" ||
        (ai?.status === "pending" &&
          run?.ambientTrack &&
          music?.audioState !== "failed")),
  );
  return (
    <>
      <PageFrame title="为你生成" backHref="/create?state=understanding" />
      <div className="generation-status glass">
        <i />
        <div>
          <strong>
            {confirmed
              ? ai?.status === "ready"
                ? "你的配乐已完成"
                : ai?.status === "failed"
                  ? "配乐暂未完成，请重试"
                  : "正在为你的回忆生成音乐…"
              : "还没有已确认的记忆"}
          </strong>
          <p>
            {!confirmed
              ? "请先返回创建并确认照片记忆"
              : ai?.source === "demo"
                ? "演示配乐 · 后续可接入真实生成服务"
                : "AI 配乐与演示推荐独立更新"}
          </p>
          <div
            className={`generation-progress ${ai?.status === "pending" && ai.progressPercent === null ? "indeterminate" : ""}`}
          >
            <span
              style={{
                width:
                  ai?.progressPercent !== null &&
                  ai?.progressPercent !== undefined
                    ? `${ai.progressPercent}%`
                    : ai?.status === "ready"
                      ? "100%"
                      : undefined,
              }}
            />
            <small>
              {ai?.progressPercent
                ? `${ai.progressPercent}%`
                : ai?.status === "pending"
                  ? "生成中"
                  : ai?.status === "failed"
                    ? "需要重试"
                    : "等待"}
            </small>
          </div>
        </div>
      </div>
      <div className="result-tabs glass">
        <button
          type="button"
          className={browseTab === "ai" ? "selected" : ""}
          onClick={() => {
            onBrowseTab?.("ai");
            if (selectedQq) music?.selectAi();
          }}
          disabled={!confirmed}
        >
          为你生成
        </button>
        <button
          type="button"
          className={browseTab === "qq" ? "selected" : ""}
          onClick={() => onBrowseTab?.("qq")}
          disabled={!confirmed}
        >
          QQ音乐推荐
        </button>
      </div>
      <Photo
        src={photoSrc ?? photo("graduation-wide")}
        alt="夕阳里的青春记忆"
        className="result-cover"
      />
      {!confirmed ? (
        <div className="music-card glass result-music-placeholder">
          <h2>尚未确认本次记忆</h2>
          <p>返回创建页完成记忆理解后再生成音乐。</p>
        </div>
      ) : browseTab === "qq" ? (
        <div className="music-card glass result-music-placeholder">
          <span className="result-source-label">演示推荐</span>
          <h2>{previewQq?.title ?? "暂无演示推荐"}</h2>
          <p>{selectedQq ? "已选择播放" : "点击下方可播推荐进行选择"}</p>
          <p className="music-description">
            {previewQq?.reason ?? "可重试加载推荐。"}
          </p>
        </div>
      ) : (
        <div className="music-card glass result-music-placeholder">
          <span className="result-source-label">
            {shownAiSource === "demo" ? "演示配乐" : "AI 配乐"}
          </span>
          <h2>
            {ai?.status === "failed"
              ? "原创配乐暂未完成"
              : (shownAiTrack?.title ?? "正在生成你的配乐")}
          </h2>
          <p>
            {ai?.status === "failed"
              ? ai.error?.message
              : shownAiTrack
                ? `${shownAiTrack.durationSec} 秒 · 可播放`
                : "先听一段氛围音乐，完成后会自动切换"}
          </p>
          <p className="music-description">
            {ai?.status === "failed" ? (
              <button
                type="button"
                className="result-retry"
                onClick={music?.retryAi}
              >
                重试原创配乐
              </button>
            ) : (
              "无歌词、无人声，来自你的记忆。"
            )}
          </p>
        </div>
      )}
      <div className="result-suggestions">
        <Link href="/play?state=adjust">
          <Sparkles />
          更青春一点
        </Link>
        <Link href="/play?state=adjust">
          <Moon />
          更安静一点
        </Link>
        <Link href="/play?state=adjust">
          <UserRound />
          少一点人声
        </Link>
      </div>
      {confirmed && recommendations && (
        <section className="result-recommendations dynamic-recommendations">
          <div className="section-title">
            <h2>
              你也可能喜欢 <small>演示推荐</small>
            </h2>
            <button type="button" onClick={music?.retryRecommendations}>
              重新加载
            </button>
          </div>
          <div className="result-recommendation-list">
            {recommendations.tracks.length === 0 && (
              <p className="recommendation-empty">
                {recommendations.status === "pending"
                  ? "正在检查演示推荐…"
                  : recommendations.status === "failed"
                    ? "推荐暂不可用，请重新加载。"
                    : "暂无可播放的演示推荐。"}
              </p>
            )}
            {recommendations.tracks.map((track) => (
              <button
                type="button"
                key={track.id}
                className={`result-recommendation ${selectedQq === track.id ? "selected" : ""}`}
                disabled={!track.playable}
                onClick={() => {
                  music?.selectRecommendation(track.id);
                  onBrowseTab?.("qq");
                }}
                aria-label={`${track.title}（演示推荐）${track.playable ? "，选择播放" : "，暂无可播放音频"}`}
              >
                <span className="recommendation-cover">
                  {track.coverUrl ? <Photo src={track.coverUrl} alt="" /> : "♪"}
                  <span className="tile-play glass">
                    {track.playable ? <Play fill="currentColor" /> : "—"}
                  </span>
                </span>
                <strong>{track.title}</strong>
                <small>
                  {track.artist} · {track.durationSec} 秒
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
      <Link
        href={!confirmed ? "/create" : canEnterPlay ? "/play" : "/result"}
        className={`result-enter pill-button lime ${!canEnterPlay && confirmed ? "disabled" : ""}`}
        aria-disabled={confirmed && !canEnterPlay}
        onClick={(event) => {
          if (confirmed && !canEnterPlay) event.preventDefault();
        }}
      >
        <Play fill="currentColor" />
        {confirmed ? "进入播放" : "返回创建"}
      </Link>
    </>
  );
}

function PlayScreen({
  music,
  memoryTitle,
  photoSrc,
  photoCount = 0,
  memorySummary,
  explanationOpen = false,
  onToggleExplanation,
  onTouchStart,
  onTouchEnd,
}: {
  music?: ResultViewModel;
  memoryTitle?: string;
  photoSrc?: string;
  photoCount?: number;
  memorySummary?: string;
  explanationOpen?: boolean;
  onToggleExplanation?: () => void;
  onTouchStart?: (event: TouchEvent) => void;
  onTouchEnd?: (event: TouchEvent) => void;
}) {
  if (!music?.run || !music.confirmed || !photoSrc)
    return (
      <>
        <PageFrame backHref="/result" />
        <div className="play-empty glass">
          <h1>还没有本次可播放的记忆</h1>
          <p>请先确认照片和音乐，再进入播放。</p>
          <Link href="/result">返回生成结果</Link>
        </div>
      </>
    );
  const active = music?.activeTrack;
  const title =
    active && "title" in active
      ? active.title
      : (music?.run?.adjustedTrack?.title ??
        music?.run?.ai.track?.title ??
        "正在准备你的音乐");
  const source =
    music?.audioKind === "qq"
      ? "QQ 音乐演示推荐"
      : music?.audioKind === "ambient"
        ? "等待中的氛围音乐"
        : (music?.run?.adjustedTrack?.source ?? music?.run?.ai.source) ===
            "demo"
          ? "AI 演示配乐"
          : "AI 原创配乐";
  const duration = music.duration;
  const mediaDuration = duration ?? 1;
  const time = Math.min(music.currentTime, duration ?? music.currentTime);
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const canSeek =
    duration !== null && Number.isFinite(duration) && duration > 0;
  const selection = music.run.selection;
  const qqTrackId = selection.kind === "qq" ? selection.trackId : null;
  const saveReady =
    music.audioState !== "failed" &&
    (music.run.selection.kind === "qq"
      ? music.run.recommendations.tracks.some(
          (item) => item.id === qqTrackId && item.playable && item.audioUrl,
        )
      : Boolean(
          music.run.adjustedTrack?.audioUrl ?? music.run.ai.track?.audioUrl,
        ));
  const explanation =
    selection.kind === "qq"
      ? music.run.recommendations.tracks.find((item) => item.id === qqTrackId)
          ?.reason
      : (music.run.adjustedTrack?.explanation ??
        (music.run.ai.status === "ready"
          ? `这段${music.run.profile.mood}的记忆，适合${music.run.profile.style}的器乐旋律。`
          : "专属配乐仍在生成，当前播放的是通用等待音乐。"));
  return (
    <div
      className="play-content"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Photo
        key={photoSrc}
        src={photoSrc}
        className="play-backdrop"
        alt={`${memoryTitle ?? "本次记忆"}的第 ${photoCount > 1 ? Math.min(photoCount, Math.floor((time / (duration || 1)) * photoCount) + 1) : 1} 张照片`}
      />
      <div className="play-shade" />
      <PageFrame backHref="/result" onBack={music.stop} />
      <div className="play-event">
        <h1>{memoryTitle ?? "正在准备你的音乐记忆"}</h1>
        <p>{memorySummary ?? "和照片一起，听见这一段记忆。"}</p>
      </div>
      <section className="player glass">
        <div className="player-heading">
          <Photo src={photoSrc} alt="当前记忆封面" />
          <div>
            <h2>{title}</h2>
            <p>
              {source}
              {music?.audioState === "blocked"
                ? " · 点击播放"
                : music?.audioState === "failed"
                  ? " · 音频不可用"
                  : ""}
              {music.run.ai.status === "failed" &&
                selection.kind === "ai" &&
                !music.run.adjustedTrack && (
                  <button
                    type="button"
                    className="play-inline-retry"
                    onClick={music.retryAi}
                  >
                    重试配乐
                  </button>
                )}
            </p>
          </div>
          <button type="button" disabled aria-label="收藏（暂未开放）">
            <Heart />
          </button>
        </div>
        <div className="player-progress">
          <input
            type="range"
            min={0}
            max={mediaDuration}
            step={0.1}
            value={canSeek ? time : 0}
            disabled={!canSeek || music.audioState === "failed"}
            onChange={(event) => music.seek(Number(event.target.value))}
            aria-label="播放进度"
            style={
              {
                "--play-progress": canSeek
                  ? `${(time / mediaDuration) * 100}%`
                  : "0%",
              } as CSSProperties
            }
          />
          <p>
            <span>{formatTime(time)}</span>
            <span>{duration ? formatTime(duration) : "--:--"}</span>
          </p>
        </div>
        <div className="player-controls">
          <button
            type="button"
            disabled={!canSeek || photoCount < 2}
            onClick={() =>
              music.seek(
                Math.max(
                  0,
                  (Math.floor((time / mediaDuration) * photoCount - 1) *
                    mediaDuration) /
                    photoCount,
                ),
              )
            }
            aria-label="上一张照片"
          >
            <SkipBack fill="currentColor" />
          </button>
          <button
            type="button"
            className="pause-button glass"
            onClick={() =>
              music.audioState === "playing"
                ? music.pause()
                : music.audioState === "ended"
                  ? void music.replay()
                  : void music.play()
            }
            aria-label={
              music.audioState === "playing"
                ? "暂停音乐"
                : music.audioState === "ended"
                  ? "重新播放"
                  : "播放音乐"
            }
          >
            {music?.audioState === "playing" ? (
              <Pause fill="currentColor" />
            ) : (
              <Play fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            disabled={!canSeek || photoCount < 2}
            onClick={() =>
              music.seek(
                Math.min(
                  mediaDuration - 0.01,
                  ((Math.floor((time / mediaDuration) * photoCount) + 1) *
                    mediaDuration) /
                    photoCount,
                ),
              )
            }
            aria-label="下一张照片"
          >
            <SkipForward fill="currentColor" />
          </button>
        </div>
      </section>
      <section
        className={`play-explanation glass ${explanationOpen ? "open" : ""}`}
        aria-label="AI 对记忆的理解"
      >
        <button
          type="button"
          onClick={onToggleExplanation}
          aria-expanded={explanationOpen}
          aria-controls="play-explanation-content"
        >
          <span className="explanation-handle" />
          {explanationOpen ? "收起 AI 理解" : "上拉查看 AI 理解"}
        </button>
        {explanationOpen && (
          <div id="play-explanation-content">
            <strong>{music.confirmed.profile.title}</strong>
            <p>{memorySummary}</p>
            <p>{explanation}</p>
            <small>{source}</small>
          </div>
        )}
      </section>
      <div className="play-actions">
        <Link className="glass" href="/play?state=adjust" onClick={music.pause}>
          <Music2 />
          调整音乐
        </Link>
        <Link
          className={`glass ${!saveReady ? "disabled" : ""}`}
          href={saveReady ? "/play?state=save" : "/play"}
          aria-disabled={!saveReady}
          title={saveReady ? "进入保存过渡" : "等待可播放的专属配乐后可保存"}
          onClick={(event) => {
            if (!saveReady) event.preventDefault();
            else music.pause();
          }}
        >
          <Sparkles />
          查看 AI 理解
          <ChevronRight />
        </Link>
      </div>
    </div>
  );
}

function SaveScreen() {
  return (
    <>
      <PageFrame title="保存音乐相册" backHref="/play" />
      <PhotoStack kind="save" />
      <section className="save-fields glass">
        <label className="save-title">
          <span>
            <GraduationCap />
          </span>
          <input aria-label="事件标题" defaultValue="2026 · 毕业那天" />
          <Pencil />
        </label>
        <label className="save-date glass">
          <CalendarDays />
          <span>时间</span>
          <input aria-label="事件月份" type="month" defaultValue="2026-06" />
          <ChevronRight />
        </label>
        <p className="created-date">创建于 2026.06.20</p>
        <div className="save-quote glass">
          <Quote />
          <span>这一段旅程，感谢所有的相遇。</span>
        </div>
        <label className="save-caption glass">
          <Pencil />
          <textarea
            maxLength={100}
            aria-label="一句话记忆"
            placeholder="写下一句话，记录此刻的心情…"
          />
          <span>0/100</span>
        </label>
      </section>
      <Link className="save-submit pill-button dark" href="/memories">
        保存到我的音乐记忆
        <ArrowRight />
      </Link>
      <Link className="save-later" href="/play">
        稍后再说
      </Link>
    </>
  );
}

function DetailScreen({ album }: { album: DemoMemoryAlbum }) {
  const aiTrack = album.tracks.find((track) => track.kind === "ai");
  const selectedTrack =
    album.tracks.find((track) => track.id === album.selectedTrackId) ??
    aiTrack ??
    album.tracks[0];
  return (
    <>
      <Photo
        src={album.coverImage || photo("garden")}
        alt={album.title}
        className="detail-backdrop"
        eager
      />
      <div className="detail-shade" />
      <PageFrame
        backHref="/memories"
        moreLabel="分享相册（暂未开放）"
        sharePlaceholder
      />
      <div className="detail-event">
        <h1>
          {album.title}
          <Pencil aria-hidden="true" />
        </h1>
        <p>
          {album.createdAt
            ? `${album.createdAt.slice(0, 4)}年 ${Number(album.createdAt.slice(5, 7))}月`
            : "日期待补充"}{" "}
          · {album.photoCount} 张照片
        </p>
      </div>
      {album.caption && (
        <div className="detail-quote glass">
          <Quote />
          <span>{album.caption}</span>
          <Quote />
        </div>
      )}
      <div className="detail-track glass">
        {selectedTrack ? (
          <Photo src={selectedTrack.image} alt={`${selectedTrack.title}封面`} />
        ) : (
          <span className="detail-track-placeholder">暂无音乐</span>
        )}
        <div>
          <h2>{selectedTrack?.title ?? "暂无音乐"}</h2>
          <p>
            {selectedTrack
              ? `${selectedTrack.sourceLabel ?? selectedTrack.artist} · ${selectedTrack.duration}`
              : "配乐将在后续阶段开放"}
          </p>
          <p>{selectedTrack?.caption}</p>
        </div>
        {selectedTrack?.audioUrl ? (
          <DetailTrackPlayer
            key={selectedTrack.audioUrl}
            audioUrl={selectedTrack.audioUrl}
            title={selectedTrack.title}
          />
        ) : (
          <span
            className="dark detail-play-placeholder"
            title="当前音源不可播放"
          >
            <Play fill="currentColor" aria-hidden="true" />
          </span>
        )}
      </div>
      <AlbumPhotoGallery photos={album.photos} title={album.title} />
      <Link
        href={`/memories/${album.id}?state=adjust`}
        className="detail-generate pill-button glass"
      >
        <Music2 />
        修改音乐
        <span className="dark">
          <ChevronRight />
        </span>
      </Link>
    </>
  );
}

export function AlbumScreen({
  screen,
  album = demoMemoryAlbums[0],
  albums = [],
  memoriesLoading,
  memoriesError,
  onMemoriesRetry,
  justSaved,
  resultTitle,
  resultPhotoSrc,
  resultConfirmed,
  resultMusic,
  resultBrowseTab,
  onResultBrowseTab,
  playPhotoCount,
  playMemorySummary,
  explanationOpen,
  onToggleExplanation,
  onPlayTouchStart,
  onPlayTouchEnd,
}: {
  screen: number;
  album?: DemoMemoryAlbum;
  albums?: DemoMemoryAlbum[];
  memoriesLoading?: boolean;
  memoriesError?: string | null;
  onMemoriesRetry?: () => void;
  justSaved?: string | null;
  resultTitle?: string;
  resultPhotoSrc?: string;
  resultConfirmed?: boolean;
  resultMusic?: ResultViewModel;
  resultBrowseTab?: "ai" | "qq";
  onResultBrowseTab?: (tab: "ai" | "qq") => void;
  playPhotoCount?: number;
  playMemorySummary?: string;
  explanationOpen?: boolean;
  onToggleExplanation?: () => void;
  onPlayTouchStart?: (event: TouchEvent) => void;
  onPlayTouchEnd?: (event: TouchEvent) => void;
}) {
  if (screen === 2 || screen === 3) return <CreateFlow />;
  if (screen === 6) return <AdjustFlow />;
  return (
    <AppShell immersive={screen === 5}>
      <main
        className={`album-screen screen-${screen}`}
        data-screen={String(screen).padStart(2, "0")}
        aria-label={
          [
            "首页 · 音乐相册",
            "创建音乐相册 · 上传照片",
            "创建音乐相册 · Agent记忆理解",
            "生成结果",
            "沉浸式播放",
            "调整音乐",
            "保存音乐相册",
            "我的音乐记忆",
            "音乐相册详情",
          ][screen - 1]
        }
      >
        {screen === 1 ? (
          <HomeScreen />
        ) : screen === 4 ? (
          <ResultScreen
            photoSrc={resultPhotoSrc}
            confirmed={resultConfirmed}
            music={resultMusic}
            browseTab={resultBrowseTab}
            onBrowseTab={onResultBrowseTab}
          />
        ) : screen === 5 ? (
          <PlayScreen
            music={resultMusic}
            memoryTitle={resultTitle}
            photoSrc={resultPhotoSrc}
            photoCount={playPhotoCount}
            memorySummary={playMemorySummary}
            explanationOpen={explanationOpen}
            onToggleExplanation={onToggleExplanation}
            onTouchStart={onPlayTouchStart}
            onTouchEnd={onPlayTouchEnd}
          />
        ) : screen === 7 ? (
          <SaveScreen />
        ) : screen === 8 ? (
          <MemoriesScreen
            albums={albums}
            loading={memoriesLoading}
            error={memoriesError}
            onRetry={onMemoriesRetry}
            justSaved={justSaved}
          />
        ) : (
          <DetailScreen album={album} />
        )}
      </main>
    </AppShell>
  );
}

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUp,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Ellipsis,
  GraduationCap,
  Heart,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Quote,
  SkipBack,
  SkipForward,
  Sparkles,
  Zap,
  Guitar,
  Moon,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { BottomNav } from "./bottom-nav";
import {
  demoMemoryAlbums,
  demoRecentAiTrack,
  getRecentDemoMemoryAlbums,
  photo,
  type DemoMemoryAlbum,
} from "./demo-data";
import { PageFrame } from "./page-frame";
import { CreateFlow } from "./create-flow";
import type { ResultViewModel } from "./music-session";

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

function AgentMessage({
  children,
  user = false,
  className = "",
}: {
  children: ReactNode;
  user?: boolean;
  className?: string;
}) {
  return (
    <div className={`agent-message ${user ? "user-message" : ""} ${className}`}>
      <span className={`agent-avatar ${user ? "user-avatar" : ""}`}>
        {user ? <Photo src={photo("graduation")} /> : <Music2 />}
      </span>
      <div className="message-bubble glass">{children}</div>
    </div>
  );
}

function Composer({
  placeholder,
  href,
  confirm = false,
}: {
  placeholder: string;
  href: string;
  confirm?: boolean;
}) {
  return (
    <div className="composer glass">
      <Link href={href} aria-label="继续上传" className="composer-add">
        <Plus />
      </Link>
      <input aria-label={placeholder} placeholder={placeholder} />
      <Link
        href={href}
        className={confirm ? "composer-confirm dark" : "composer-send dark"}
        aria-label={confirm ? "一键确认，开始生成" : "发送调整指令"}
      >
        {confirm ? (
          <>
            一键确认，开始生成
            <ChevronRight />
          </>
        ) : (
          <ArrowUp />
        )}
      </Link>
    </div>
  );
}

function Waveform() {
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => 12 + ((i * 17) % 57)).map(
        (height) => (
          <i key={height} style={{ height: `${height}%` }} />
        ),
      )}
    </div>
  );
}

function MusicCard({
  title = "青春的回声",
  adjusted = false,
  home = false,
}: {
  title?: string;
  adjusted?: boolean;
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
      {adjusted ? (
        <Waveform />
      ) : (
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
      )}
      <Link
        href={home ? "/create" : "/play"}
        className="music-play dark"
        aria-label={adjusted ? "重新播放" : "进入播放"}
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
      <Link href="/create" className="home-create glass">
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
            {ai?.source === "demo" ? "演示配乐" : "AI 配乐"}
          </span>
          <h2>
            {ai?.status === "failed"
              ? "原创配乐暂未完成"
              : (ai?.track?.title ?? "正在生成你的配乐")}
          </h2>
          <p>
            {ai?.status === "failed"
              ? ai.error?.message
              : ai?.track
                ? `${ai.track.durationSec} 秒 · 可播放`
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
}: {
  music?: ResultViewModel;
  memoryTitle?: string;
  photoSrc?: string;
}) {
  const active = music?.activeTrack;
  const title =
    active && "title" in active
      ? active.title
      : (music?.run?.ai.track?.title ?? "正在准备你的音乐");
  const source =
    music?.audioKind === "qq"
      ? "QQ 音乐演示推荐"
      : music?.audioKind === "ambient"
        ? "等待中的氛围音乐"
        : music?.run?.ai.source === "demo"
          ? "AI 演示配乐"
          : "AI 原创配乐";
  return (
    <>
      <Photo
        src={photoSrc ?? photo("graduation-backdrop")}
        className="play-backdrop"
        alt="毕业那天的夕阳"
      />
      <div className="play-shade" />
      <PageFrame backHref="/result" />
      <div className="play-event">
        <h1>{memoryTitle ?? "正在准备你的音乐记忆"}</h1>
        <p>那些以后很难再重复的普通日子。</p>
      </div>
      <section className="player glass">
        <div className="player-heading">
          <Photo src={photo("graduation")} alt="青春的回声封面" />
          <div>
            <h2>{title}</h2>
            <p>
              {source}
              {music?.audioState === "blocked"
                ? " · 点击播放"
                : music?.audioState === "failed"
                  ? " · 音频不可用"
                  : ""}
            </p>
          </div>
          <button type="button" disabled aria-label="收藏（暂未开放）">
            <Heart />
          </button>
        </div>
        <div className="player-progress">
          <div>
            <i />
          </div>
          <p>
            <span>0:12</span>
            <span>0:28</span>
          </p>
        </div>
        <div className="player-controls">
          <button type="button" disabled aria-label="上一首（暂未开放）">
            <SkipBack fill="currentColor" />
          </button>
          <button
            type="button"
            className="pause-button glass"
            onClick={() => void music?.play()}
            aria-label="播放音乐"
          >
            {music?.audioState === "playing" ? (
              <Pause fill="currentColor" />
            ) : (
              <Play fill="currentColor" />
            )}
          </button>
          <button type="button" disabled aria-label="下一首（暂未开放）">
            <SkipForward fill="currentColor" />
          </button>
        </div>
      </section>
      <div className="play-actions">
        <Link className="glass" href="/play?state=adjust">
          <Music2 />
          调整音乐
        </Link>
        <Link className="glass" href="/play?state=save" aria-label="保存相册">
          <Sparkles />
          查看 AI 理解
          <ChevronRight />
        </Link>
      </div>
    </>
  );
}

function AdjustScreen() {
  return (
    <>
      <PageFrame title="调整音乐" backHref="/play" />
      <AgentMessage user className="adjust-user">
        我想更青春一点，节奏更快一些。
      </AgentMessage>
      <AgentMessage className="adjust-agent">
        好的，我将音乐调整得更轻快，
        <br />
        充满青春感，节奏也更明快了一些。
      </AgentMessage>
      <Photo
        src={photo("graduation-wide")}
        alt="青春版配乐封面"
        className="adjust-cover"
      />
      <MusicCard title="青春的回声（青春版）" adjusted />
      <div className="adjust-suggestions">
        <Link href="/play">
          <Zap />
          再快一点
        </Link>
        <Link href="/play">
          <Guitar />
          多一点吉他
        </Link>
        <Link href="/play">
          <Sparkles />
          换一种风格
        </Link>
      </div>
      <Composer placeholder="继续告诉我你的想法…" href="/play" />
    </>
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

function MemoriesScreen() {
  return (
    <>
      <PageFrame title="我的音乐记忆" large />
      <div className="memory-filters">
        {["全部", "旅行", "生活", "宠物", "其他"].map((label, index) => (
          <button
            key={label}
            type="button"
            disabled
            className={index === 0 ? "selected" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="memory-list">
        {demoMemoryAlbums.length === 0 && (
          <div className="memory-list-empty glass">
            <strong>还没有音乐记忆</strong>
            <p>上传照片，让第一段回忆拥有自己的声音。</p>
            <Link href="/create">创建音乐相册</Link>
          </div>
        )}
        {getRecentDemoMemoryAlbums().map((album, index) => (
          <Link
            className="memory-row glass"
            href={`/memories/${album.id}`}
            key={album.id}
            aria-label={`查看${album.title}详情`}
          >
            <div className="memory-row-cover">
              <Photo
                src={album.coverImage || photo("garden")}
                alt={album.title}
                eager={index === 0}
              />
              <span className="tile-play glass">
                <Play fill="currentColor" />
              </span>
            </div>
            <div className="memory-row-info">
              <h2>{album.title}</h2>
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
            <Ellipsis className="memory-row-more" aria-hidden="true" />
          </Link>
        ))}
      </div>
      <BottomNav />
    </>
  );
}

function DetailScreen({ album }: { album: DemoMemoryAlbum }) {
  const aiTrack = album.tracks.find((track) => track.kind === "ai");
  const recommendedTracks = album.tracks.filter((track) => track.kind === "qq");
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
        {aiTrack ? (
          <Photo src={aiTrack.image} alt={`${aiTrack.title}封面`} />
        ) : (
          <span className="detail-track-placeholder">暂无音乐</span>
        )}
        <div>
          <h2>{aiTrack?.title ?? "暂无音乐"}</h2>
          <p>
            {aiTrack
              ? `${aiTrack.artist} · ${aiTrack.duration}`
              : "配乐将在后续阶段开放"}
          </p>
          <p>{aiTrack?.caption}</p>
        </div>
        <span className="dark detail-play-placeholder" title="播放配乐暂未开放">
          <Play fill="currentColor" aria-hidden="true" />
        </span>
      </div>
      <section className="detail-recommendations">
        <div className="section-title">
          <h2>推荐歌曲</h2>
          <span>
            查看全部
            <ChevronRight />
          </span>
        </div>
        <div className="detail-track-list">
          {recommendedTracks.length === 0 && (
            <p className="detail-no-recommendations">暂无推荐歌曲</p>
          )}
          {recommendedTracks.map((track) => (
            <div className="detail-recommendation glass" key={track.id}>
              <Photo src={track.image} alt={track.title} />
              <div>
                <h3>{track.title}</h3>
                <p>
                  {track.artist} · {track.duration}
                </p>
                <p>{track.caption}</p>
              </div>
              <span title={`${track.title}试听暂未开放`}>
                <Play fill="currentColor" aria-hidden="true" />
              </span>
            </div>
          ))}
        </div>
      </section>
      <Link href="/result" className="detail-generate pill-button glass">
        <Music2 />
        生成音乐
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
  resultTitle,
  resultPhotoSrc,
  resultConfirmed,
  resultMusic,
  resultBrowseTab,
  onResultBrowseTab,
}: {
  screen: number;
  album?: DemoMemoryAlbum;
  resultTitle?: string;
  resultPhotoSrc?: string;
  resultConfirmed?: boolean;
  resultMusic?: ResultViewModel;
  resultBrowseTab?: "ai" | "qq";
  onResultBrowseTab?: (tab: "ai" | "qq") => void;
}) {
  if (screen === 2 || screen === 3) return <CreateFlow />;
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
          />
        ) : screen === 6 ? (
          <AdjustScreen />
        ) : screen === 7 ? (
          <SaveScreen />
        ) : screen === 8 ? (
          <MemoriesScreen />
        ) : (
          <DetailScreen album={album} />
        )}
      </main>
    </AppShell>
  );
}

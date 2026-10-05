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
  demoTracks,
  photo,
  type DemoMemoryAlbum,
} from "./demo-data";
import { PageFrame } from "./page-frame";

function Photo({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={800}
      unoptimized
      className={`album-photo ${className}`}
    />
  );
}

function PhotoStack({
  kind,
}: {
  kind: "home" | "upload" | "understanding" | "save";
}) {
  const names =
    kind === "home"
      ? ["garden", "sunset", "vinyl"]
      : kind === "understanding"
        ? ["garden", "graduation-wide", "graduation", "travel", "vinyl"]
        : ["travel", "graduation", "cat", "garden", "sunset", "vinyl"];
  return (
    <div className={`photo-stack stack-${kind}`}>
      {names.map((name, index) => (
        <Photo
          key={name}
          src={photo(name)}
          alt={`记忆照片 ${index + 1}`}
          className={`stack-photo stack-photo-${index + 1}`}
        />
      ))}
      {kind === "upload" && (
        <Link
          className="add-photo glass"
          href="/create?state=understanding"
          aria-label="添加照片"
        >
          <Plus />
          <span>1–9张</span>
        </Link>
      )}
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
      <h2>{home ? "日落海岸" : title}</h2>
      <p>{home ? "独立流行 · 3:28" : "AI 原创配乐 · 0:28"}</p>
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
      {demoMemoryAlbums.slice(0, 3).map((album, index) => (
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
              : ["青春的最后一页", "海风与自由", "小小的幸福"][index]}
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
      <section className="home-memories">
        <div className="section-title">
          <h2>我的音乐记忆</h2>
          <Link href="/memories">
            查看全部
            <ChevronRight />
          </Link>
        </div>
        <MemoryTiles />
      </section>
      <BottomNav />
    </>
  );
}

function CreateScreen({ understanding }: { understanding: boolean }) {
  return (
    <>
      <PageFrame title="创建音乐相册" backHref="/" />
      <PhotoStack kind={understanding ? "understanding" : "upload"} />
      {understanding ? (
        <>
          <div className="understanding-status glass">
            <Sparkles />
            正在理解你的照片…
          </div>
          <AgentMessage className="understanding-message">
            <p>
              我看到这是一段关于大学毕业的回忆。照片里有和朋友们在校园里的欢乐时光，有毕业典礼的难忘瞬间，也有夕阳下的合影，充满了青春、友谊和对未来的期待。
            </p>
            <p>
              表面上看是热闹的毕业季，但更深处，是那些曾经习以为常的日子——一起上课、一起吃饭、一起熬夜聊天——在分别后，才变得格外珍贵。
            </p>
          </AgentMessage>
          <div className="event-title glass">
            <span>
              <GraduationCap />
            </span>
            <strong>2026 · 毕业那天</strong>
            <button
              type="button"
              aria-label="编辑事件标题（暂未开放）"
              disabled
            >
              <Pencil />
            </button>
          </div>
          <AgentMessage className="confirm-message">
            这样的理解对吗？你也可以告诉我…
          </AgentMessage>
          <div className="understanding-suggestions">
            <button type="button" disabled>
              更快乐一点
            </button>
            <button type="button" disabled>
              这是毕业，不是旅行
            </button>
            <button type="button" disabled>
              少一点伤感
            </button>
            <button type="button" disabled>
              加一些朋友的热闹感
            </button>
          </div>
          <Composer placeholder="继续补充或直接确认…" href="/result" confirm />
        </>
      ) : (
        <>
          <div className="upload-caption">
            <h2>上传 1–9 张照片</h2>
            <p>让 AI 帮你把回忆变成一首歌</p>
          </div>
          <AgentMessage className="upload-message-one">
            发给我一组照片，我会先理解
            <br />
            这段回忆，再帮你生成音乐。
          </AgentMessage>
          <AgentMessage user className="upload-user">
            这是我的毕业季照片，想做成
            <br />
            一段有点青春也有点不舍的记忆。
          </AgentMessage>
          <AgentMessage className="upload-message-two">
            太好了！这些照片充满了青春的故事。
            <br />
            你还可以告诉我一些细节，比如想要的音乐风格、氛围，或者这段回忆的关键词，我会为你量身创作。
          </AgentMessage>
          <Composer
            placeholder="和我聊聊这组照片…"
            href="/create?state=understanding"
          />
        </>
      )}
    </>
  );
}

function ResultScreen() {
  return (
    <>
      <PageFrame title="为你生成" backHref="/create?state=understanding" />
      <div className="generation-status glass">
        <i />
        <div>
          <strong>正在为你的回忆生成音乐…</strong>
          <p>约 20 秒</p>
          <div className="generation-progress">
            <span />
            <small>60%</small>
          </div>
        </div>
      </div>
      <div className="result-tabs glass">
        <button type="button" className="selected" disabled>
          为你生成
        </button>
        <button type="button" disabled>
          QQ音乐推荐
        </button>
      </div>
      <Photo
        src={photo("graduation-wide")}
        alt="夕阳里的青春记忆"
        className="result-cover"
      />
      <MusicCard />
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
      <section className="result-recommendations">
        <div className="section-title">
          <h2>你也可能喜欢</h2>
          <span>
            查看全部
            <ChevronRight />
          </span>
        </div>
        <MemoryTiles recommendations />
      </section>
      <Link href="/play" className="result-enter pill-button lime">
        <Play fill="currentColor" />
        进入播放
      </Link>
    </>
  );
}

function PlayScreen() {
  return (
    <>
      <Photo
        src={photo("graduation-backdrop")}
        className="play-backdrop"
        alt="毕业那天的夕阳"
      />
      <div className="play-shade" />
      <PageFrame backHref="/result" />
      <div className="play-event">
        <h1>2026 · 毕业那天</h1>
        <p>那些以后很难再重复的普通日子。</p>
      </div>
      <section className="player glass">
        <div className="player-heading">
          <Photo src={photo("graduation")} alt="青春的回声封面" />
          <div>
            <h2>青春的回声</h2>
            <p>AI 原创配乐</p>
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
            disabled
            aria-label="播放／暂停（后续接入音源）"
          >
            <Pause fill="currentColor" />
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
          <p>
            还没有音乐记忆，先创建一段吧。
            <Link href="/create">创建音乐相册</Link>
          </p>
        )}
        {demoMemoryAlbums.map((album) => (
          <Link
            className="memory-row glass"
            href={`/memories/${album.id}`}
            key={album.id}
            aria-label={`查看${album.title}详情`}
          >
            <div className="memory-row-cover">
              <Photo src={album.coverImage} alt={album.title} />
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
              <time>{album.eventDate.replaceAll("-", ".")}</time>
            </div>
            <Ellipsis className="memory-row-more" />
          </Link>
        ))}
      </div>
      <BottomNav />
    </>
  );
}

function DetailScreen({ album }: { album: DemoMemoryAlbum }) {
  return (
    <>
      <Photo
        src={album.coverImage}
        alt={album.title}
        className="detail-backdrop"
      />
      <div className="detail-shade" />
      <PageFrame backHref="/memories" />
      <div className="detail-event">
        <h1>
          {album.title}
          <Pencil />
        </h1>
        <p>
          {album.eventDate.slice(0, 4)}年 {Number(album.eventDate.slice(5, 7))}
          月 · {album.photoCount} 张照片
        </p>
      </div>
      <div className="detail-quote glass">
        <Quote />
        <span>{album.caption}</span>
        <Quote />
      </div>
      <div className="detail-track glass">
        <Photo src={photo("sunset")} alt="青春的回声封面" />
        <div>
          <h2>青春的回声</h2>
          <p>AI 原创配乐 · 0:28</p>
          <p>
            把时光写成一首歌，
            <br />
            在路上与自己相遇。
          </p>
        </div>
        <Link className="dark" href="/play" aria-label="播放配乐">
          <Play fill="currentColor" />
        </Link>
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
          {demoTracks.map((track) => (
            <div className="detail-recommendation glass" key={track.id}>
              <Photo src={track.image} alt={track.title} />
              <div>
                <h3>{track.title}</h3>
                <p>
                  {track.artist} · {track.duration}
                </p>
                <p>{track.caption}</p>
              </div>
              <Link href="/play" aria-label={`试听${track.title}`}>
                <Play fill="currentColor" />
              </Link>
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
}: {
  screen: number;
  album?: DemoMemoryAlbum;
}) {
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
        ) : screen === 2 || screen === 3 ? (
          <CreateScreen understanding={screen === 3} />
        ) : screen === 4 ? (
          <ResultScreen />
        ) : screen === 5 ? (
          <PlayScreen />
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

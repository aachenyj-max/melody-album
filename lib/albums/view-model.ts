import type {
  DemoMemoryAlbum,
  DemoTrack,
} from "@/components/music-album/demo-data";

export type AlbumListItem = {
  id: string;
  title: string;
  eventDate: string | null;
  caption: string;
  photoCount: number;
  createdAt: string;
  selectedKind: "ai" | "qq";
  coverUrl: string;
};

export type AlbumDetail = AlbumListItem & {
  selectedTrackId: string;
  memory: {
    event?: string | null;
    atmosphere?: string | null;
    source?: string;
  };
  photos: Array<{ position: number; url: string }>;
  music: Array<{
    version_id: string;
    kind: "ai" | "qq";
    status: string;
    source: string | null;
    title: string | null;
    artist: string | null;
    audio_url: string | null;
    duration_sec: number | null;
    selected: boolean;
    error_code: string | null;
  }>;
  recommendations: Array<{
    track_id: string;
    title: string;
    artist: string;
    cover_url: string | null;
    reason: string;
    audio_url: string | null;
    duration_sec: number | null;
    playable: boolean;
    source: "mock";
  }>;
  runs: Array<{
    kind: string;
    status: string;
    source: string | null;
    error_code: string | null;
  }>;
};

function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function toAlbumCard(item: AlbumListItem): DemoMemoryAlbum {
  const created = item.createdAt.slice(0, 10);
  return {
    id: item.id,
    title: item.title,
    coverImage: item.coverUrl,
    photos: [item.coverUrl],
    tracks: [],
    createdAt: created,
    eventDate: item.eventDate ?? "",
    caption: item.caption,
    subtitle:
      item.caption ||
      (item.selectedKind === "qq" ? "QQ 音乐演示推荐" : "AI 原创配乐"),
    photoCount: item.photoCount,
    trackCount: 1,
    category: "其他",
  };
}

export function toAlbumDetail(item: AlbumDetail): DemoMemoryAlbum {
  const base = toAlbumCard(item);
  const cover = item.photos[0]?.url ?? item.coverUrl;
  const tracks: DemoTrack[] = item.music.map((version) => ({
    id: version.version_id,
    title:
      version.title ??
      (version.status === "failed" ? "配乐未完成" : "音乐待补充"),
    artist:
      version.artist ?? (version.kind === "ai" ? "AI 原创配乐" : "QQ 音乐"),
    kind: version.kind,
    status: version.audio_url ? "ready" : "placeholder",
    duration: duration(version.duration_sec),
    caption: version.error_code
      ? `当前状态：${version.error_code}`
      : (item.memory.event ?? item.memory.atmosphere ?? ""),
    image: cover,
    audioUrl: version.audio_url,
    sourceLabel:
      version.source === "demo"
        ? "AI 演示配乐"
        : version.source === "mock"
          ? "QQ 音乐演示推荐"
          : "AI 原创配乐",
  }));
  for (const recommendation of item.recommendations) {
    if (tracks.some((track) => track.id === `qq:${recommendation.track_id}`))
      continue;
    tracks.push({
      id: `qq:${recommendation.track_id}`,
      title: recommendation.title,
      artist: recommendation.artist,
      kind: "qq",
      status:
        recommendation.playable && recommendation.audio_url
          ? "ready"
          : "placeholder",
      duration: duration(recommendation.duration_sec),
      caption: recommendation.reason,
      image: recommendation.cover_url ?? cover,
      audioUrl: recommendation.playable ? recommendation.audio_url : null,
      sourceLabel: "QQ 音乐演示推荐",
    });
  }
  return {
    ...base,
    coverImage: cover,
    photos: item.photos.map((photo) => photo.url),
    tracks,
    subtitle: item.memory.event ?? item.memory.atmosphere ?? base.subtitle,
    trackCount: tracks.filter((track) => track.status === "ready").length,
    selectedTrackId: item.music.find((version) => version.selected)?.version_id,
  };
}

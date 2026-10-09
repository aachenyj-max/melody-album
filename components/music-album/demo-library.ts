import type { AlbumMusicCandidate } from "@/lib/albums/music-contract";
import {
  type DemoMemoryAlbum,
  type DemoTrack,
  demoMemoryAlbums,
} from "./demo-data";
import generatedMusic from "./generated-demo-music.json";

const storageKey = "music-album-demo-library-v1";
const musicStorageKey = "music-album-demo-music-v1";
type Override = { title: string; caption: string } | null;
type Overrides = Record<string, Override>;

export const demoLibrary: DemoMemoryAlbum[] = demoMemoryAlbums.map(
  (album, index) => {
    const music = generatedMusic[album.id as keyof typeof generatedMusic];
    const seconds = Math.round(music.durationSec);
    const coverImage =
      index === 0
        ? "/images/memories/demo-graduation.webp"
        : index === 1
          ? "/images/memories/demo-coast.webp"
          : album.coverImage;
    const photos =
      index === 0
        ? [coverImage, "/images/memories/graduation.webp"]
        : index === 1
          ? [coverImage, album.coverImage]
          : album.photos;
    const tracks = album.tracks
      .filter((track) => track.kind === "ai")
      .map((track) => ({
        ...track,
        title: music.title,
        artist: music.style,
        image: coverImage,
        status: "ready" as const,
        duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
        audioUrl: music.audioUrl,
        sourceLabel: "AI 原创配乐",
      }));
    return {
      ...album,
      coverImage,
      photos,
      tracks,
      photoCount: photos.length,
      trackCount: tracks.length,
      selectedTrackId: tracks[0]?.id,
    };
  },
);

function readOverrides(): Overrides {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, entry]) =>
          demoLibrary.some((album) => album.id === id) &&
          (entry === null ||
            (typeof entry === "object" &&
              typeof entry.title === "string" &&
              typeof entry.caption === "string")),
      ),
    );
  } catch {
    return {};
  }
}

export function readDemoLibrary() {
  const overrides = readOverrides();
  const music = readMusicOverrides();
  return demoLibrary
    .filter((album) => overrides[album.id] !== null)
    .map((album) => {
      const edit = overrides[album.id];
      const base = edit ? { ...album, ...edit, subtitle: edit.caption } : album;
      const saved = music[album.id];
      return saved
        ? {
            ...base,
            tracks: [saved.current, ...saved.history],
            selectedTrackId: saved.current.id,
          }
        : base;
    });
}

type MusicOverride = { current: DemoTrack; history: DemoTrack[] };
function readMusicOverrides(): Record<string, MusicOverride> {
  try {
    const raw = JSON.parse(localStorage.getItem(musicStorageKey) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([id, value]) => {
          const entry = value as MusicOverride;
          return (
            demoLibrary.some((album) => album.id === id) &&
            entry?.current?.kind === "ai" &&
            typeof entry.current.audioUrl === "string" &&
            Array.isArray(entry.history)
          );
        })
        .map(([id, value]) => [id, value as MusicOverride]),
    );
  } catch {
    return {};
  }
}

export function confirmDemoMusic(id: string, candidate: AlbumMusicCandidate) {
  const album = readDemoLibrary().find((item) => item.id === id);
  if (!album || album.selectedTrackId !== candidate.baseTrackId)
    throw new Error("相册音乐已更新，请返回详情后重试。");
  const current: DemoTrack = {
    id: candidate.versionId,
    title: candidate.track.title,
    artist: "AI 原创配乐",
    kind: "ai",
    status: "ready",
    duration: `${Math.floor(candidate.track.durationSec / 60)}:${String(Math.round(candidate.track.durationSec) % 60).padStart(2, "0")}`,
    caption: album.caption,
    image: album.coverImage,
    audioUrl: candidate.track.audioUrl,
    sourceLabel: "AI 原创配乐",
  };
  localStorage.setItem(
    musicStorageKey,
    JSON.stringify({
      ...readMusicOverrides(),
      [id]: { current, history: album.tracks },
    }),
  );
}

export function changeDemoAlbum(id: string, edit: Override) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ ...readOverrides(), [id]: edit }),
  );
}

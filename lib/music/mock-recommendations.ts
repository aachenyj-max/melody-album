import type { MockRecommendation, MusicProfile } from "./contract";

const tracks = [
  {
    id: "mock-sunlit-steps",
    title: "阳光下的脚步（演示）",
    artist: "Demo Artist A",
    reason: "和明亮、向前的记忆氛围相配",
    coverUrl: "/images/memories/sunset.webp",
  },
  {
    id: "mock-soft-goodbye",
    title: "轻轻告别（演示）",
    artist: "Demo Artist B",
    reason: "适合温柔而带一点不舍的时刻",
    coverUrl: "/images/memories/graduation.webp",
  },
  {
    id: "mock-night-window",
    title: "窗边的夜色（演示）",
    artist: "Demo Artist C",
    reason: "给安静的回忆留出呼吸感",
    coverUrl: "/images/memories/vinyl.webp",
  },
] as const;

export function getMockRecommendations(
  profile: MusicProfile,
): MockRecommendation[] {
  const index =
    profile.tempo === "lively" ? 0 : profile.tempo === "slow" ? 2 : 1;
  return tracks.map((track, offset) => ({
    ...track,
    durationSec: 24 + offset * 2,
    source: "mock" as const,
    audioUrl: offset === index ? "/audio/music-album/mock-qq.wav" : null,
    playable: offset === index,
  }));
}

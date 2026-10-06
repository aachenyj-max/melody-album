import type { MemoryProfile } from "@/lib/memory/contract";
import {
  MUSIC_CONTRACT_VERSION,
  type MusicProfile,
  type Structure,
  type Tempo,
} from "./contract";

export function toMusicProfile(memory: MemoryProfile): MusicProfile {
  const mood = (memory.atmosphere || memory.event || "平静而温暖的回忆")
    .trim()
    .slice(0, 100);
  const lively = /欢|笑|庆|毕业|旅行|阳光|热闹|奔跑/.test(mood);
  const calm = /静|安|夜|雨|思念|告别|温柔/.test(mood);
  const tempo: Tempo = lively ? "lively" : calm ? "slow" : "moderate";
  const structure: Structure = lively
    ? "uplifting"
    : calm
      ? "gentle"
      : "steady";
  const style = lively
    ? "轻快钢琴与木吉他"
    : calm
      ? "柔和钢琴与氛围弦乐"
      : "温暖钢琴与轻柔吉他";
  const instrumentalPrompt = `无歌词、无人声，${style}，${mood}，${structure === "uplifting" ? "逐渐明亮" : structure === "gentle" ? "平缓舒展" : "稳定推进"}的音乐。`;
  return {
    contractVersion: MUSIC_CONTRACT_VERSION,
    memoryVersion: memory.version,
    memoryTitle: memory.title.trim().slice(0, 100),
    mood,
    style,
    tempo,
    structure,
    instrumentalPrompt: instrumentalPrompt.slice(0, 600),
    targetDurationSec: 28,
  };
}

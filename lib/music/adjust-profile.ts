import type { MusicProfile } from "./contract";

export function adjustedProfile(
  profile: MusicProfile,
  instruction: string,
): MusicProfile {
  const lower = instruction.toLowerCase();
  const tempo = /快|活泼|快乐|青春|bright|upbeat/.test(lower)
    ? "lively"
    : /慢|安静|轻柔|舒缓|quiet|soft/.test(lower)
      ? "slow"
      : profile.tempo;
  const mood = /快乐|开心|青春/.test(lower)
    ? "明亮、快乐、充满青春感"
    : /安静|轻柔|舒缓/.test(lower)
      ? "安静、温柔、舒缓"
      : profile.mood;
  return {
    ...profile,
    mood,
    tempo,
    instrumentalPrompt:
      `${profile.instrumentalPrompt.slice(0, 260)}。在此前记忆音乐的基础上调整：${instruction.slice(0, 280)}。保持无歌词、无人声。`.slice(
        0,
        600,
      ),
  };
}

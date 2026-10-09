import type { AiTrack } from "@/lib/music/contract";

export type AlbumMusicCandidate = {
  versionId: string;
  baseTrackId: string;
  track: AiTrack;
  responseText: string;
};

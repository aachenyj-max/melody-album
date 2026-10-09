import "server-only";
import { validateMusicProfile } from "@/lib/music/contract";
import cat from "@/specs/006-save-memory-album/verification/generated-music/demo-cat.json";
import garden from "@/specs/006-save-memory-album/verification/generated-music/demo-garden.json";
import graduation from "@/specs/006-save-memory-album/verification/generated-music/demo-graduation.json";
import travel from "@/specs/006-save-memory-album/verification/generated-music/demo-travel.json";

const albums: Record<string, unknown> = {
  "demo-graduation": graduation.musicProfile,
  "demo-travel": travel.musicProfile,
  "demo-cat": cat.musicProfile,
  "demo-garden": garden.musicProfile,
};

export function demoMusicProfile(id: string) {
  return validateMusicProfile(albums[id]);
}

import type { ReactNode } from "react";
import { CreationSessionProvider } from "@/components/music-album/creation-session";
import { MusicSessionProvider } from "@/components/music-album/music-session";
export default function AlbumLayout({ children }: { children: ReactNode }) {
  return (
    <CreationSessionProvider>
      <MusicSessionProvider>{children}</MusicSessionProvider>
    </CreationSessionProvider>
  );
}

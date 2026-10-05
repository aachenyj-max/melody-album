import type { ReactNode } from "react";
import { CreationSessionProvider } from "@/components/music-album/creation-session";
export default function AlbumLayout({ children }: { children: ReactNode }) {
  return <CreationSessionProvider>{children}</CreationSessionProvider>;
}

import { AlbumScreen } from "@/components/music-album/album-screen";
import { PlayFlow } from "@/components/music-album/play-flow";
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  if (state === "adjust" || state === "save")
    return <AlbumScreen screen={state === "adjust" ? 6 : 7} />;
  return <PlayFlow />;
}

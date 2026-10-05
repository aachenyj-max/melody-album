import { AlbumScreen } from "@/components/music-album/album-screen";
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  return (
    <AlbumScreen screen={state === "adjust" ? 6 : state === "save" ? 7 : 5} />
  );
}

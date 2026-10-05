import { AlbumScreen } from "@/components/music-album/album-screen";
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  return <AlbumScreen screen={state === "understanding" ? 3 : 2} />;
}

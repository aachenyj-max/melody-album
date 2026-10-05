import { notFound } from "next/navigation";
import { AlbumScreen } from "@/components/music-album/album-screen";
import { getDemoMemoryAlbum } from "@/components/music-album/demo-data";
export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = getDemoMemoryAlbum(id);
  if (!album) notFound();
  return <AlbumScreen screen={9} album={album} />;
}

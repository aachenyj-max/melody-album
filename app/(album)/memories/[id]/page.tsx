import { DetailFlow } from "@/components/music-album/detail-flow";
export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailFlow id={id} />;
}

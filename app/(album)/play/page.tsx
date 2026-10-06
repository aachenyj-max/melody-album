import { PlayFlow } from "@/components/music-album/play-flow";
import { AdjustFlow } from "@/components/music-album/adjust-flow";
import { SaveGate } from "@/components/music-album/save-gate";
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  if (state === "adjust") return <AdjustFlow />;
  if (state === "save") return <SaveGate />;
  return <PlayFlow />;
}

import { Suspense } from "react";
import { MemoriesFlow } from "@/components/music-album/memories-flow";
export default function MemoriesPage() {
  return (
    <Suspense fallback={null}>
      <MemoriesFlow />
    </Suspense>
  );
}

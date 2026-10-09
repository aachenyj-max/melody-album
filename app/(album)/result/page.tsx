import { ResultFlow } from "@/components/music-album/result-flow";
import { Suspense } from "react";
export default function ResultPage() {
  return (
    <Suspense fallback={<p role="status">正在恢复已确认的记忆…</p>}>
      <ResultFlow />
    </Suspense>
  );
}

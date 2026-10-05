import Link from "next/link";
import { AppShell } from "@/components/music-album/app-shell";
import { PageFrame } from "@/components/music-album/page-frame";
export default function MemoryNotFound() {
  return (
    <AppShell>
      <PageFrame title="音乐记忆" backHref="/memories" />
      <main className="memory-empty">
        <h1>没有找到这张音乐相册</h1>
        <p>请返回列表查看已有记忆。</p>
        <Link href="/memories" className="pill-button dark">
          返回音乐记忆
        </Link>
      </main>
    </AppShell>
  );
}

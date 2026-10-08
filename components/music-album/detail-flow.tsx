"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./app-shell";
import { PageFrame } from "./page-frame";
import { AlbumScreen } from "./album-screen";
import { toAlbumDetail, type AlbumDetail } from "@/lib/albums/view-model";

export function DetailFlow({ id }: { id: string }) {
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetch("/api/albums/session", {
        method: "POST",
        cache: "no-store",
      });
      if (!session.ok) throw new Error("暂时无法建立相册会话，请重试。");
      const response = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "找不到这段音乐记忆。"
            : "相册暂时无法读取，请重试。",
        );
      const result = await response.json();
      setAlbum(result.album);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "相册暂时无法读取，请重试。",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);
  if (loading || error || !album)
    return (
      <AppShell>
        <main className="album-screen screen-9" data-screen="09">
          <PageFrame backHref="/memories" />
          <div
            className="memory-list-empty detail-read-state glass"
            role={error ? "alert" : "status"}
          >
            <strong>{error ?? "正在读取音乐记忆…"}</strong>
            {error && (
              <>
                <button type="button" onClick={() => void reload()}>
                  重试
                </button>
                <Link href="/memories">返回列表</Link>
              </>
            )}
          </div>
        </main>
      </AppShell>
    );
  return <AlbumScreen screen={9} album={toAlbumDetail(album)} />;
}

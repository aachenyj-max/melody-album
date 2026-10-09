"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type AlbumListItem, toAlbumCard } from "@/lib/albums/view-model";
import { AlbumScreen } from "./album-screen";
import type { DemoMemoryAlbum } from "./demo-data";
import { demoLibrary, readDemoLibrary } from "./demo-library";

export function MemoriesFlow() {
  const searchParams = useSearchParams();
  const [demos, setDemos] = useState<DemoMemoryAlbum[]>(demoLibrary);
  const [items, setItems] = useState<AlbumListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setDemos(readDemoLibrary());
    setLoading(true);
    setError(null);
    try {
      const session = await fetch("/api/albums/session", {
        method: "POST",
        cache: "no-store",
      });
      if (!session.ok) throw new Error("暂时无法建立相册会话，请重试。");
      const response = await fetch("/api/albums", { cache: "no-store" });
      if (!response.ok) throw new Error("音乐记忆暂时无法读取，请重试。");
      const body = await response.json();
      setItems(body.albums);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取失败，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <AlbumScreen
      screen={8}
      albums={[...items.map(toAlbumCard), ...demos]}
      memoriesLoading={loading}
      memoriesError={error}
      onMemoriesRetry={() => void reload()}
      justSaved={searchParams.get("justSaved")}
    />
  );
}

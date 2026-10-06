"use client";

import { useEffect, useState } from "react";
import { AlbumScreen } from "./album-screen";
import { useCreationSession } from "./creation-session";
import { useMusicSession } from "./music-session";

export function ResultFlow() {
  const { confirmed } = useCreationSession();
  const { run, start, ...music } = useMusicSession();
  const [preview, setPreview] = useState<string>();
  const [browseTab, setBrowseTab] = useState<"ai" | "qq">("ai");
  useEffect(() => {
    if (!confirmed?.photos[confirmed.profile.photoOrder[0]]) return;
    const url = URL.createObjectURL(
      confirmed.photos[confirmed.profile.photoOrder[0]],
    );
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [confirmed]);
  useEffect(() => {
    if (confirmed) start(confirmed);
  }, [confirmed, start]);
  return (
    <AlbumScreen
      screen={4}
      resultPhotoSrc={preview}
      resultConfirmed={Boolean(confirmed)}
      resultMusic={{ run, start, ...music }}
      resultBrowseTab={browseTab}
      onResultBrowseTab={setBrowseTab}
    />
  );
}

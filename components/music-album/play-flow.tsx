"use client";

import { useEffect, useState } from "react";
import { AlbumScreen } from "./album-screen";
import { useCreationSession } from "./creation-session";
import { useMusicSession } from "./music-session";

export function PlayFlow() {
  const { confirmed } = useCreationSession();
  const music = useMusicSession();
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!confirmed?.photos[0]) return;
    const url = URL.createObjectURL(confirmed.photos[0]);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [confirmed]);
  useEffect(() => {
    if (confirmed) music.start(confirmed);
  }, [confirmed, music.start]);
  return (
    <AlbumScreen
      screen={5}
      resultTitle={confirmed?.profile.title}
      resultPhotoSrc={preview}
      resultConfirmed={Boolean(confirmed)}
      resultMusic={music}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { AlbumScreen } from "./album-screen";
import { useCreationSession } from "./creation-session";

export function ResultFlow() {
  const { confirmed } = useCreationSession();
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!confirmed?.photos[0]) return;
    const url = URL.createObjectURL(confirmed.photos[0]);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [confirmed]);
  return (
    <AlbumScreen
      screen={4}
      resultTitle={confirmed?.profile.title}
      resultPhotoSrc={preview}
      resultConfirmed={Boolean(confirmed)}
    />
  );
}

"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { AlbumScreen } from "./album-screen";
import { useCreationSession } from "./creation-session";
import { useMusicSession } from "./music-session";

export function PlayFlow() {
  const { confirmed } = useCreationSession();
  const music = useMusicSession();
  const [photos, setPhotos] = useState<string[]>([]);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    if (!confirmed) return;
    const urls = confirmed.profile.photoOrder.map((index) =>
      URL.createObjectURL(confirmed.photos[index]),
    );
    setPhotos(urls);
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [confirmed]);
  useEffect(() => {
    if (confirmed) music.start(confirmed);
  }, [confirmed, music.start]);
  useEffect(() => {
    if (music.run && music.audioState === "idle") void music.play();
  }, [music.run, music.audioState, music.play]);
  const duration = music.duration;
  const photoIndex =
    photos.length > 1 && duration && duration > 0
      ? Math.min(
          photos.length - 1,
          Math.floor((music.currentTime / duration) * photos.length),
        )
      : 0;
  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current === null) return;
    const distance =
      touchStart.current -
      (event.changedTouches[0]?.clientY ?? touchStart.current);
    if (distance > 40) setExplanationOpen(true);
    if (distance < -40) setExplanationOpen(false);
    touchStart.current = null;
  };
  return (
    <AlbumScreen
      screen={5}
      resultTitle={confirmed?.profile.title}
      resultPhotoSrc={photos[photoIndex]}
      playPhotoCount={photos.length}
      playMemorySummary={
        confirmed?.profile.event ?? confirmed?.profile.atmosphere ?? undefined
      }
      explanationOpen={explanationOpen}
      onToggleExplanation={() => setExplanationOpen((open) => !open)}
      onPlayTouchStart={onTouchStart}
      onPlayTouchEnd={onTouchEnd}
      resultConfirmed={Boolean(confirmed)}
      resultMusic={music}
    />
  );
}

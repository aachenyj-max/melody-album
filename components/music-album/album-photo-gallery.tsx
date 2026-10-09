"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function AlbumPhotoGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (index !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [index]);
  return (
    <>
      <section className="detail-photos" aria-label="相册照片">
        <div className="section-title">
          <h2>相册照片</h2>
          <span>{photos.length} 张照片</span>
        </div>
        <div className="detail-photo-grid">
          {photos.map((src, position) => (
            <button
              type="button"
              key={src}
              aria-label={`查看第 ${position + 1} 张照片`}
              onClick={() => setIndex(position)}
            >
              <Image
                src={src}
                alt={`${title} · 第 ${position + 1} 张照片`}
                width={600}
                height={600}
                unoptimized
              />
            </button>
          ))}
          {photos.length === 0 && <p>暂无照片</p>}
        </div>
      </section>
      <dialog
        className="album-photo-dialog"
        ref={dialog}
        aria-label="照片详情"
        onCancel={() => setIndex(null)}
      >
        <button
          type="button"
          className="photo-dialog-close"
          aria-label="关闭照片详情"
          onClick={() => setIndex(null)}
        >
          <X />
        </button>
        {index !== null && (
          <>
            <Image
              src={photos[index]}
              alt={`${title} · 第 ${index + 1} 张照片`}
              width={1200}
              height={1200}
              unoptimized
            />
            <div className="photo-dialog-controls">
              <button
                type="button"
                aria-label="上一张照片"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft />
              </button>
              <span>
                {index + 1} / {photos.length}
              </span>
              <button
                type="button"
                aria-label="下一张照片"
                disabled={index === photos.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                <ChevronRight />
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

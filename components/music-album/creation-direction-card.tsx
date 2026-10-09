"use client";
import { Sparkles, ChevronRight } from "lucide-react";
import {
  cardCanConfirm,
  type CreationDraft,
  type DirectionCard,
} from "@/lib/creation/contract";
export function CreationDirectionCard({
  draft,
  card,
  busy,
  onConfirm,
}: {
  draft: CreationDraft;
  card: DirectionCard;
  busy: boolean;
  onConfirm: (card: DirectionCard) => void;
}) {
  const eligible = cardCanConfirm(draft, card);
  const status = {
    active: "待确认",
    stale: "待更新",
    superseded: "已更新",
    confirmed: "已确认",
  }[card.status];
  return (
    <section
      className="creation-card glass"
      aria-label={`第 ${card.version} 版音乐方向`}
    >
      <div className="creation-card-heading">
        <Sparkles />
        <strong>{card.memory.title}</strong>
        <span>
          {status} · {card.version}
        </span>
      </div>
      <p>{card.memory.event || card.memory.atmosphere}</p>
      <dl>
        <div>
          <dt>情绪</dt>
          <dd>{card.music.mood}</dd>
        </div>
        <div>
          <dt>音乐</dt>
          <dd>{card.music.style}</dd>
        </div>
        <div>
          <dt>编曲</dt>
          <dd>
            {card.music.instrumentalPrompt.replace(
              /^无歌词[、，, ]*无人声[、，, ]*/,
              "",
            )}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className="dark"
        disabled={busy || !eligible}
        onClick={() => onConfirm(card)}
      >
        按这个生成
        <ChevronRight />
      </button>
      {card.status === "stale" && (
        <small>你补充了新内容，等本轮理解更新后再确认。</small>
      )}
    </section>
  );
}

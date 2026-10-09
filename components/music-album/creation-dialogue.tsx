"use client";
import { Music2 } from "lucide-react";
import { structureDialogueReply } from "@/lib/agent/dialogue-reply";
import type { CreationDraft, DirectionCard } from "@/lib/creation/contract";
import { CreationDirectionCard } from "./creation-direction-card";
export function CreationDialogue({
  draft,
  busy,
  onConfirm,
  onRetry,
}: {
  draft: CreationDraft;
  busy: boolean;
  onConfirm: (card: DirectionCard) => void;
  onRetry: (turnId: string) => void;
}) {
  return (
    <section className="creation-messages" aria-label="记忆对话记录">
      <div className="agent-message">
        <span className="agent-avatar">
          <Music2 />
        </span>
        <div className="message-bubble glass">
          发给我一组照片，我会先理解这段回忆，再帮你生成音乐。
        </div>
      </div>
      {draft.messages.map((message) => {
        const turn = draft.turns.find((t) => t.id === message.turnId);
        const retryable =
          message.role === "user" &&
          turn &&
          ["pending", "failed", "interrupted"].includes(turn.status);
        if (message.kind === "direction_card") {
          const card = draft.cards.find((c) => c.id === message.cardId);
          return card ? (
            <CreationDirectionCard
              key={message.id}
              draft={draft}
              card={card}
              busy={busy}
              onConfirm={onConfirm}
            />
          ) : null;
        }
        return (
          <div
            className={`agent-message ${message.role === "user" ? "user-message" : ""}`}
            key={message.id}
            data-message-id={message.id}
          >
            <span
              className={`agent-avatar ${message.role === "user" ? "user-avatar" : ""}`}
            >
              <Music2 />
            </span>
            <div className="message-bubble glass">
              {message.role === "assistant" ? (
                <div className="creation-reply">
                  {structureDialogueReply(message.text)
                    .split(/\n\s*\n/)
                    .map((paragraph) => {
                      const labeled = paragraph.match(
                        /^(照片里|你的补充|音乐建议|想确认)[：:]\s*([\s\S]*)$/,
                      );
                      return (
                        <p key={`${message.id}-${paragraph}`}>
                          {labeled ? (
                            <>
                              <strong>{labeled[1]}</strong>
                              {labeled[2]}
                            </>
                          ) : (
                            paragraph
                          )}
                        </p>
                      );
                    })}
                </div>
              ) : (
                <p>{message.text}</p>
              )}
              {retryable && (
                <div className="creation-turn-error" role="status">
                  <span>
                    {turn.error || (busy ? "正在处理…" : "本轮还未完成")}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRetry(turn.id)}
                    disabled={busy}
                  >
                    重试
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

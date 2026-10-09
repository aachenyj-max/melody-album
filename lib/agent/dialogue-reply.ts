import type { CreationMessage } from "@/lib/creation/contract";

export function dialogueRound(messages: readonly CreationMessage[]): number {
  const boundary = messages.findLastIndex(
    (message) =>
      message.kind === "photo_change" || message.kind === "direction_card",
  );
  return (
    1 +
    messages
      .slice(boundary + 1)
      .filter((message) => message.role === "user" && message.kind === "text")
      .length
  );
}

/** Add paragraph breaks without changing the words in old or new replies. */
export function structureDialogueReply(text: string): string {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks
    .flatMap((block) => {
      const sentences =
        block.match(/[^。！？!?]+[。！？!?]+|[^。！？!?]+$/g) ?? [];
      const paragraphs: string[] = [];
      let current = "";
      for (const sentence of sentences) {
        const value = sentence.trim();
        const question = /[？?]/.test(value);
        if (current && (question || current.length + value.length > 70)) {
          paragraphs.push(current);
          current = "";
        }
        current += value;
        if (question) {
          paragraphs.push(current);
          current = "";
        }
      }
      if (current) paragraphs.push(current);
      return paragraphs;
    })
    .join("\n\n");
}

/** Prefer whole sentences and one follow-up over repeated descriptive detail. */
export function compactDialogueReply(text: string): string {
  const structured = structureDialogueReply(retainSingleQuestion(text));
  const blocks = structured.split(/\n\s*\n/).filter(Boolean);
  if (structured.length <= 180 && blocks.length <= 3) return structured;
  const question = blocks.findLast((block) => /[？?]/.test(block));
  const selected: string[] = [];
  let remaining = 180 - (question?.length ?? 0) - (question ? 2 : 0);
  for (const block of blocks.filter((value) => !/[？?]/.test(value))) {
    const sentence =
      block.match(/^[\s\S]*?[。！!]|^[\s\S]+$/)?.[0]?.trim() ?? "";
    if (sentence && sentence.length <= remaining && selected.length < 2) {
      selected.push(sentence);
      remaining -= sentence.length + 2;
    }
  }
  if (question) selected.push(question);
  return selected.length ? selected.join("\n\n") : (blocks[0] ?? "");
}

/** Keep observations and the final follow-up; discard earlier question sentences. */
export function retainSingleQuestion(text: string): string {
  if ((text.match(/[？?]/g)?.length ?? 0) <= 1) return text.trim();
  const sentences = text.match(/[^。！？!?]+[。！？!?]+|[^。！？!?]+$/g) ?? [];
  const finalQuestion = sentences.findLastIndex((sentence) =>
    /[？?]/.test(sentence),
  );
  return sentences
    .filter(
      (sentence, index) => !/[？?]/.test(sentence) || index === finalQuestion,
    )
    .join("")
    .trim();
}

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

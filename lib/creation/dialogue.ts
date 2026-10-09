import "server-only";
import { runCreationDialogue } from "@/lib/agent/dialogue-runtime";
import { activeTurn, CreationError, uuid } from "./contract";
import { analysisPhotos } from "./photos";
import {
  readDraft,
  writeDraft,
  expectRevision,
  staleCards,
  appendMessage,
  startTurn,
  type DraftRow,
} from "./repository";

export async function receiveMessage(
  row: DraftRow,
  raw: Record<string, unknown>,
) {
  const clientMessageId = uuid(raw.clientMessageId);
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text || text.length > 1000)
    throw new CreationError("INVALID_INPUT", "请输入 1–1000 字的消息。");
  const previous = row.state.messages.find(
    (m) => m.clientMessageId === clientMessageId,
  );
  if (previous) {
    if (previous.text !== text)
      throw new CreationError("CONFLICT", "消息内容已变化。", 409);
    return { row, turnId: previous.turnId };
  }
  expectRevision(row, raw.expectedRevision);
  if (activeTurn(row.state))
    throw new CreationError("BUSY", "请先等待或重试上一轮回复。", 409);
  row.state.messageRevision++;
  staleCards(row.state);
  const message = appendMessage(row.state, {
    role: "user",
    kind: "text",
    text,
    clientMessageId,
  });
  const turn = startTurn(row.state, message);
  return { row: await writeDraft(row, row.state), turnId: turn.id };
}
export async function executeTurn(
  owner: string,
  draftId: string,
  turnId: string,
  request: Request,
) {
  let row = await readDraft(owner, draftId);
  const turn = row.state.turns.find((t) => t.id === turnId);
  if (!turn) throw new CreationError("NOT_FOUND", "该轮对话不存在。", 404);
  if (turn.status === "succeeded") return row;
  if (
    ["running", "superseded"].includes(turn.status) ||
    activeTurn(row.state)?.id !== turnId
  )
    throw new CreationError(
      "CONFLICT",
      "本轮正在处理或已被新照片更新，请刷新。",
      409,
    );
  turn.status = "running";
  turn.attempt++;
  turn.token = crypto.randomUUID();
  turn.leaseUntil = new Date(Date.now() + 60000).toISOString();
  delete turn.error;
  delete turn.code;
  const token = turn.token;
  row = await writeDraft(row, row.state, false);
  try {
    if (
      process.env.NODE_ENV === "development" &&
      row.config.memoryModel.mode === "demo"
    ) {
      const fixture = request.headers.get("x-demo-scenario");
      if (["timeout", "unavailable", "invalid-result"].includes(fixture || ""))
        throw new CreationError(
          fixture === "timeout"
            ? "AGENT_TIMEOUT"
            : fixture === "invalid-result"
              ? "INVALID_RESULT"
              : "AGENT_UNAVAILABLE",
          "演示故障：本轮消息已保留，请重试。",
          fixture === "timeout"
            ? 504
            : fixture === "invalid-result"
              ? 502
              : 503,
        );
    }
    const result = await runCreationDialogue(
      row,
      await analysisPhotos(row),
      request.signal,
    );
    const latest = await readDraft(owner, draftId);
    const current = latest.state.turns.find((t) => t.id === turnId);
    if (
      current?.token !== token ||
      current.status !== "running" ||
      Date.parse(current.leaseUntil || "") <= Date.now() ||
      latest.state.photoRevision !== turn.photoRevision ||
      latest.state.messageRevision !== turn.messageRevision
    )
      throw new CreationError(
        "CONFLICT",
        "照片或对话已更新，本轮旧结果已忽略。",
        409,
      );
    appendMessage(latest.state, {
      role: "assistant",
      kind: "text",
      text: result.text,
      turnId,
    });
    if (result.proposal) {
      for (const c of latest.state.cards) c.status = "superseded";
      const card = {
        ...result.proposal,
        id: crypto.randomUUID(),
        version: latest.state.cards.length + 1,
        messageRevision: latest.state.messageRevision,
        photoRevision: latest.state.photoRevision,
        status: "active" as const,
      };
      latest.state.cards.push(card);
      appendMessage(latest.state, {
        role: "assistant",
        kind: "direction_card",
        text: card.summary,
        turnId,
        cardId: card.id,
      });
    }
    current.status = "succeeded";
    delete current.token;
    delete current.leaseUntil;
    return await writeDraft(latest, latest.state);
  } catch (error) {
    const safe =
      error instanceof CreationError
        ? error
        : new CreationError(
            "AGENT_UNAVAILABLE",
            "本轮回复失败，消息已保留，请重试。",
            503,
          );
    try {
      const latest = await readDraft(owner, draftId);
      const current = latest.state.turns.find((t) => t.id === turnId);
      if (current?.token === token && current.status === "running") {
        current.status = "failed";
        current.code = safe.code;
        current.error = safe.message;
        delete current.token;
        delete current.leaseUntil;
        await writeDraft(latest, latest.state, false);
      }
    } catch {
      /* Persisted lease permits interruption recovery after a storage outage. */
    }
    throw safe;
  }
}

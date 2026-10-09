import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { userAgentConfig } from "@/lib/agent/release";
import { dialogueConfig } from "@/lib/agent/dialogue-config";
import type { ConfigSnapshot } from "@/lib/workbench/contract";
import {
  activeTurn,
  CreationError,
  type CreationDraft,
  type CreationState,
  type CreationMessage,
} from "./contract";

export type DraftRow = {
  id: string;
  owner_key: string;
  revision: number;
  config: ConfigSnapshot;
  dialogue_config: ReturnType<typeof dialogueConfig>;
  state: CreationState;
  expires_at: string;
};
export function emptyState(): CreationState {
  return {
    messageRevision: 0,
    photoRevision: 0,
    messages: [],
    turns: [],
    photos: [],
    photoIds: [],
    cards: [],
    snapshots: [],
    photoRequests: [],
  };
}
export async function createDraft(owner: string, requestId: string) {
  const db = createAdminClient();
  const existing = await db
    .from("creation_drafts")
    .select("*")
    .eq("owner_key", owner)
    .eq("request_id", requestId)
    .maybeSingle();
  if (existing.error)
    throw new CreationError("DATA_UNAVAILABLE", "暂时无法读取对话。", 503);
  if (existing.data) return readDraft(owner, existing.data.id);
  const config = await userAgentConfig();
  const inserted = await db
    .from("creation_drafts")
    .insert({
      owner_key: owner,
      request_id: requestId,
      config,
      dialogue_config: dialogueConfig(),
      state: emptyState(),
    })
    .select("*")
    .single();
  if (inserted.error?.code === "23505") {
    const retry = await db
      .from("creation_drafts")
      .select("id")
      .eq("owner_key", owner)
      .eq("request_id", requestId)
      .single();
    if (retry.data) return readDraft(owner, retry.data.id);
  }
  if (inserted.error || !inserted.data)
    throw new CreationError("DATA_UNAVAILABLE", "暂时无法建立对话。", 503);
  return inserted.data as DraftRow;
}
export async function readDraft(owner: string, id: string): Promise<DraftRow> {
  const { data, error } = await createAdminClient()
    .from("creation_drafts")
    .select("*")
    .eq("id", id)
    .eq("owner_key", owner)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error)
    throw new CreationError(
      "DATA_UNAVAILABLE",
      "暂时无法恢复对话，请重试。",
      503,
    );
  if (!data)
    throw new CreationError(
      "NOT_FOUND",
      "对话不存在、已到期，或不属于当前会话。",
      404,
    );
  const row = data as DraftRow;
  const turn = activeTurn(row.state);
  if (
    turn?.status === "running" &&
    Date.parse(turn.leaseUntil || "") <= Date.now()
  ) {
    turn.status = "interrupted";
    turn.error = "本轮处理已中断，请重试。";
    delete turn.token;
    try {
      return await writeDraft(row, row.state, false);
    } catch (error) {
      if (!(error instanceof CreationError) || error.code !== "CONFLICT")
        throw error;
      return readDraft(owner, id);
    }
  }
  return row;
}
export async function writeDraft(
  row: DraftRow,
  state: CreationState,
  touch = true,
): Promise<DraftRow> {
  const { data, error } = await createAdminClient().rpc(
    "creation_draft_commit",
    {
      p_id: row.id,
      p_owner: row.owner_key,
      p_revision: row.revision,
      p_state: state,
      p_touch: touch,
    },
  );
  if (error)
    throw new CreationError(
      error.message.includes("CONFLICT") ? "CONFLICT" : "DATA_UNAVAILABLE",
      error.message.includes("CONFLICT")
        ? "对话已变化，请刷新后继续。"
        : "本轮暂时无法保存，请重试。",
      error.message.includes("CONFLICT") ? 409 : 503,
    );
  return data as DraftRow;
}
export function expectRevision(row: DraftRow, value: unknown) {
  if (!Number.isSafeInteger(value) || value !== row.revision)
    throw new CreationError("CONFLICT", "对话已变化，请刷新后继续。", 409);
}
export function staleCards(state: CreationState) {
  for (const card of state.cards)
    if (["active", "confirmed"].includes(card.status)) card.status = "stale";
}
export function appendMessage(
  state: CreationState,
  value: Omit<CreationMessage, "id" | "seq" | "at">,
) {
  const message: CreationMessage = {
    ...value,
    id: crypto.randomUUID(),
    seq: state.messages.length + 1,
    at: new Date().toISOString(),
  };
  state.messages.push(message);
  return message;
}
export function startTurn(state: CreationState, message: CreationMessage) {
  const turn = {
    id: crypto.randomUUID(),
    messageId: message.id,
    messageRevision: state.messageRevision,
    photoRevision: state.photoRevision,
    status: "pending" as const,
    attempt: 0,
  };
  message.turnId = turn.id;
  state.turns.push(turn);
  return turn;
}
export function publicDraft(row: DraftRow): CreationDraft {
  const { state } = row;
  return {
    id: row.id,
    revision: row.revision,
    source: row.config.memoryModel.mode === "live" ? "agent" : "demo",
    dialogueVersion: row.dialogue_config.version,
    expiresAt: row.expires_at,
    messageRevision: state.messageRevision,
    photoRevision: state.photoRevision,
    messages: state.messages,
    turns: state.turns.map(
      ({ token: _token, leaseUntil: _lease, ...turn }) => turn,
    ),
    cards: state.cards,
    photos: state.photoIds.map((id) => {
      const photo = state.photos.find((p) => p.id === id);
      if (!photo)
        throw new CreationError("INVALID_STATE", "照片记录不完整。", 503);
      return {
        id,
        name: photo.name,
        mime: photo.mime,
        bytes: photo.bytes,
        url: `/api/creation/drafts/${row.id}/photos?photoId=${id}`,
      };
    }),
  };
}

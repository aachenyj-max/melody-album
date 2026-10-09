import type { MemoryProfile } from "@/lib/memory/contract";
import type { MusicProfile } from "@/lib/music/contract";

export const CREATION_BUCKET = "creation-photos";
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class CreationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw new CreationError("INVALID_INPUT", "请求标识无效。");
  return value;
}
export type CreationPhoto = {
  id: string;
  path: string;
  mime: string;
  bytes: number;
  name: string;
  status: "uploading" | "active" | "removed" | "cleanup_pending";
  requestId: string;
};
export type CreationMessage = {
  id: string;
  seq: number;
  role: "user" | "assistant" | "system";
  kind: "text" | "photo_change" | "direction_card";
  text: string;
  at: string;
  clientMessageId?: string;
  turnId?: string;
  cardId?: string;
};
export type CreationTurn = {
  id: string;
  messageId: string;
  messageRevision: number;
  photoRevision: number;
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "interrupted"
    | "superseded";
  attempt: number;
  token?: string;
  leaseUntil?: string;
  error?: string;
  code?: string;
};
export type DirectionCard = {
  id: string;
  version: number;
  messageRevision: number;
  photoRevision: number;
  memory: MemoryProfile;
  music: MusicProfile;
  summary: string;
  status: "active" | "stale" | "superseded" | "confirmed";
};
export type CreationSnapshot = {
  id: string;
  cardId: string;
  memory: MemoryProfile;
  music: MusicProfile;
  photoIds: string[];
  at: string;
};
export type CreationState = {
  messageRevision: number;
  photoRevision: number;
  messages: CreationMessage[];
  turns: CreationTurn[];
  photos: CreationPhoto[];
  photoIds: string[];
  cards: DirectionCard[];
  snapshots: CreationSnapshot[];
  photoRequests: { requestId: string; photoIds: string[]; turnId: string }[];
};
export type CreationDraft = {
  id: string;
  revision: number;
  source: "agent" | "demo";
  dialogueVersion: string;
  messageRevision: number;
  photoRevision: number;
  messages: CreationMessage[];
  turns: Omit<CreationTurn, "token" | "leaseUntil">[];
  photos: {
    id: string;
    name: string;
    mime: string;
    bytes: number;
    url: string;
  }[];
  cards: DirectionCard[];
  expiresAt: string;
};
export function activeTurn(state: Pick<CreationState, "turns">) {
  return state.turns.findLast(
    (turn) => !["succeeded", "superseded"].includes(turn.status),
  );
}
export function cardCanConfirm(
  draft: Pick<
    CreationDraft,
    "cards" | "turns" | "photos" | "messageRevision" | "photoRevision"
  >,
  card: DirectionCard,
) {
  return (
    card.id === draft.cards.at(-1)?.id &&
    ["active", "confirmed"].includes(card.status) &&
    card.messageRevision === draft.messageRevision &&
    card.photoRevision === draft.photoRevision &&
    draft.photos.length > 0 &&
    !activeTurn(draft)
  );
}

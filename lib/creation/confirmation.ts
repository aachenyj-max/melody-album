import "server-only";
import { CreationError, uuid, cardCanConfirm } from "./contract";
import {
  readDraft,
  writeDraft,
  expectRevision,
  publicDraft,
  type DraftRow,
} from "./repository";

export async function confirmDirection(
  row: DraftRow,
  raw: Record<string, unknown>,
) {
  uuid(raw.requestId);
  const cardId = uuid(raw.cardId);
  const card = row.state.cards.find((c) => c.id === cardId);
  if (
    !card ||
    !cardCanConfirm(publicDraft(row), card) ||
    raw.messageRevision !== row.state.messageRevision ||
    raw.photoRevision !== row.state.photoRevision
  )
    throw new CreationError(
      "STALE_CARD",
      "音乐方向已更新，请确认最新版本。",
      409,
    );
  const previous = row.state.snapshots.find((s) => s.cardId === cardId);
  if (previous) return { snapshotId: previous.id, draftId: row.id };
  expectRevision(row, raw.expectedRevision);
  const snapshot = {
    id: crypto.randomUUID(),
    cardId,
    memory: card.memory,
    music: card.music,
    photoIds: [...row.state.photoIds],
    at: new Date().toISOString(),
  };
  row.state.snapshots.push(snapshot);
  card.status = "confirmed";
  await writeDraft(row, row.state);
  return { snapshotId: snapshot.id, draftId: row.id };
}
export async function readSnapshot(
  owner: string,
  draftId: string,
  snapshotId: string,
) {
  const row = await readDraft(owner, uuid(draftId));
  const snapshot = row.state.snapshots.find((s) => s.id === uuid(snapshotId));
  if (!snapshot) throw new CreationError("NOT_FOUND", "确认记录不存在。", 404);
  return {
    ...snapshot,
    draftId: row.id,
    photos: snapshot.photoIds.map((id) => {
      const p = row.state.photos.find((p) => p.id === id);
      if (!p) throw new CreationError("NOT_FOUND", "确认照片不存在。", 404);
      return {
        id,
        name: p.name,
        mime: p.mime,
        bytes: p.bytes,
        url: `/api/creation/drafts/${row.id}/photos?photoId=${id}`,
      };
    }),
  };
}

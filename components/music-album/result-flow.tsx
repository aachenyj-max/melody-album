"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlbumScreen } from "./album-screen";
import { useCreationSession } from "./creation-session";
import { useMusicSession } from "./music-session";
import { snapshotInput } from "@/lib/creation/client";

export function ResultFlow() {
  const { confirmed, confirm } = useCreationSession();
  const query = useSearchParams();
  const draftId = query.get("draft");
  const snapshotId = query.get("snapshot");
  const currentConfirmed =
    confirmed &&
    (!snapshotId ||
      (confirmed.draftId === draftId && confirmed.snapshotId === snapshotId))
      ? confirmed
      : null;
  const [restoreError, setRestoreError] = useState("");
  useEffect(() => {
    const draft = draftId;
    const snapshot = snapshotId;
    if (!draft || !snapshot) return;
    if (confirmed?.draftId === draft && confirmed.snapshotId === snapshot)
      return;
    let mounted = true;
    void snapshotInput(draft, snapshot)
      .then((input) => {
        if (mounted) {
          setRestoreError("");
          confirm(input);
        }
      })
      .catch((e: Error) => {
        if (mounted) setRestoreError(e.message);
      });
    return () => {
      mounted = false;
    };
  }, [confirmed, confirm, draftId, snapshotId]);
  const { run, start, ...music } = useMusicSession();
  const [preview, setPreview] = useState<string>();
  const [browseTab, setBrowseTab] = useState<"ai" | "qq">("ai");
  useEffect(() => {
    if (!currentConfirmed?.photos[currentConfirmed.profile.photoOrder[0]]) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(
      currentConfirmed.photos[currentConfirmed.profile.photoOrder[0]],
    );
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [currentConfirmed]);
  useEffect(() => {
    if (currentConfirmed) start(currentConfirmed);
  }, [currentConfirmed, start]);
  return (
    <>
      <AlbumScreen
        screen={4}
        resultPhotoSrc={preview}
        resultConfirmed={Boolean(currentConfirmed)}
        resultMusic={{ run, start, ...music }}
        resultBrowseTab={browseTab}
        onResultBrowseTab={setBrowseTab}
      />
      {restoreError && (
        <div className="result-restore-error" role="alert">
          {restoreError}
          <button type="button" onClick={() => window.location.reload()}>
            重试恢复
          </button>
        </div>
      )}
    </>
  );
}

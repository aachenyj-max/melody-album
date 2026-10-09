"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";
import { validateMusicProfile, type MusicProfile } from "@/lib/music/contract";

export type ConfirmedMemory = {
  profile: MemoryProfile;
  photos: File[];
  musicProfile?: MusicProfile;
  draftId?: string;
  snapshotId?: string;
};
type Session = {
  confirmed: ConfirmedMemory | null;
  confirm: (value: ConfirmedMemory) => void;
};
const Context = createContext<Session | null>(null);

export function CreationSessionProvider({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState<ConfirmedMemory | null>(null);
  const confirm = useCallback((value: ConfirmedMemory) => {
    const valid = normalizeProfile(value.profile, value.photos.length);
    if (
      valid &&
      (!value.musicProfile || validateMusicProfile(value.musicProfile))
    )
      setConfirmed({ ...value, profile: valid, photos: [...value.photos] });
  }, []);
  return (
    <Context.Provider value={{ confirmed, confirm }}>
      {children}
    </Context.Provider>
  );
}

export function useCreationSession(): Session {
  const context = useContext(Context);
  if (!context) throw new Error("Creation session provider missing");
  return context;
}

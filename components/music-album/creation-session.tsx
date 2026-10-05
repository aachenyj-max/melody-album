"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";

export type ConfirmedMemory = { profile: MemoryProfile; photos: File[] };
type Session = {
  confirmed: ConfirmedMemory | null;
  confirm: (value: ConfirmedMemory) => void;
};
const Context = createContext<Session | null>(null);

export function CreationSessionProvider({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState<ConfirmedMemory | null>(null);
  function confirm(value: ConfirmedMemory) {
    const valid = normalizeProfile(value.profile, value.photos.length);
    if (valid) setConfirmed({ profile: valid, photos: [...value.photos] });
  }
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

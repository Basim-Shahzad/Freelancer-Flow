"use client";

import { create } from "zustand";

/** Genuinely local UI state only. Server data lives in react-query; the timer outbox in `lib/time/outbox-store`. */
interface AppStore {
  online: boolean;
  setOnline(v: boolean): void;
}

export const useAppStore = create<AppStore>()((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/** Mirrors navigator.onLine into the store and syncs queued entries when back online. */
export function useOnlineSync(): void {
  const setOnline = useAppStore((s) => s.setOnline);
  const markSynced = useAppStore((s) => s.markSynced);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { setOnline(true); t = setTimeout(markSynced, 900); };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); if (t) clearTimeout(t); };
  }, [setOnline, markSynced]);
}

export const useIsOnline = () => useAppStore((s) => s.online);

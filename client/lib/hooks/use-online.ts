"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Mirrors navigator.onLine into the store. Replaying the offline time outbox when the connection returns is
 * `useTimeSync`'s job (it watches this flag).
 */
export function useOnlineSync(): void {
  const setOnline = useAppStore((s) => s.setOnline);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setOnline]);
}

export const useIsOnline = () => useAppStore((s) => s.online);

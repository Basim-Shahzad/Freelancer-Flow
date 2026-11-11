"use client";

import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Mirrors navigator.onLine into the store and react-query's onlineManager (store stays the UI source of truth). Replaying the offline time outbox when the connection returns is
 * `useTimeSync`'s job (it watches this flag).
 */
export function useOnlineSync(): void {
  const setOnline = useAppStore((s) => s.setOnline);
  useEffect(() => {
    const apply = (v: boolean) => { setOnline(v); onlineManager.setOnline(v); };
    const on = () => apply(true);
    const off = () => apply(false);
    apply(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setOnline]);
}

export const useIsOnline = () => useAppStore((s) => s.online);

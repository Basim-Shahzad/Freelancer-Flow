"use client";

import { useAppStore } from "@/lib/store";

/** True once persisted state has loaded in the browser. Gate store-driven UI on this. */
export function useHydrated(): boolean {
  return useAppStore((s) => s.hydrated);
}

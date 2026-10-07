"use client";

import { WifiOff } from "lucide-react";
import { useAppStore } from "@/lib/store";

/** "offline · N unsynced" in the top bar. Only renders while offline. */
export function OfflineBadge() {
  const online = useAppStore((s) => s.online);
  const unsynced = useAppStore((s) => s.time.filter((t) => t.unsynced).length);
  if (online) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--warning)_55%,var(--border))] bg-warning-tint px-2.5 py-1 text-xs font-semibold">
      <WifiOff className="size-[1.1em] text-warning-ink" aria-hidden="true" />
      offline · {unsynced} unsynced
    </span>
  );
}

"use client";

import { WifiOff } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";

/** Shown on data screens while offline. Reads are from the last sync; edits queue on this device. */
export function OfflineNotice({ detail }: { detail?: string }) {
  const online = useAppStore((s) => s.online);
  const unsynced = useAppStore(useShallow((s) => s.time.filter((t) => t.unsynced).length));
  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_55%,var(--border))] bg-warning-tint px-3 py-3 text-sm">
      <WifiOff className="mt-0.5 size-[1.125rem] shrink-0 text-warning-ink" aria-hidden="true" />
      <span>
        You’re offline. Showing figures from your last sync.{" "}
        {detail ?? (unsynced > 0 ? `${unsynced} time ${unsynced === 1 ? "entry is" : "entries are"} saved on this device and will sync when you’re back online.` : "Changes are saved on this device and sync when you reconnect.")}
      </span>
    </div>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { useAppStore } from "@/lib/store";
import { useOutbox } from "@/lib/time/outbox-store";
import { flushOutbox } from "./sync";

/**
 * Restores the persisted outbox, then replays it when the browser comes back online and once on mount if it is
 * already online. Mount it once, in the app shell.
 */
export function useTimeSync(): void {
  const qc = useQueryClient();
  const { isAuthenticated } = useSession();
  const online = useAppStore((s) => s.online);

  useEffect(() => {
    void useOutbox.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !online) return;
    void flushOutbox(qc);
  }, [isAuthenticated, online, qc]);
}

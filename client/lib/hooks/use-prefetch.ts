"use client";

import { type QueryClient, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { clientKeys } from "@/lib/hooks/clients/use-clients";
import { invoiceKeys } from "@/lib/hooks/invoices/use-invoices";
import { projectKeys } from "@/lib/hooks/projects/use-projects";
import { STALE } from "@/lib/hooks/stale-times";
import { clientsService } from "@/lib/services/clients.service";
import { invoicesService } from "@/lib/services/invoices.service";
import { projectsService } from "@/lib/services/projects.service";
import { useAppStore } from "@/lib/store";

export interface IntentHandlers {
  onPointerEnter: () => void;
  onFocus: () => void;
}

/**
 * Prefetches only on pointer-enter / focus (never on viewport entry). Skipped while offline; react-query itself skips
 * fresh data (`staleTime`) and dedupes in-flight requests, so repeated hovers fire at most one request.
 * Never use on portal routes: the first invoice view stamps `viewedAt`.
 */
export function prefetchOnIntent(qc: QueryClient, online: boolean, key: QueryKey, fn: () => Promise<unknown>, staleTime: number): IntentHandlers {
  const go = () => {
    if (!online) return;
    void qc.prefetchQuery({ queryKey: key, queryFn: fn, staleTime });
  };
  return { onPointerEnter: go, onFocus: go };
}

/** Returns a factory `(key, fn, staleTime?) => handlers` (a factory because rows are rendered in `.map`). */
export function usePrefetchOnIntent() {
  const qc = useQueryClient();
  const online = useAppStore((s) => s.online);
  return useCallback(
    (key: QueryKey, fn: () => Promise<unknown>, staleTime: number = STALE.STABLE) => prefetchOnIntent(qc, online, key, fn, staleTime),
    [qc, online],
  );
}

/** Detail-link handlers for list rows. */
export function usePrefetchDetail() {
  const intent = usePrefetchOnIntent();
  return {
    client: (id: string) => intent(clientKeys.detail(id), () => clientsService.get(id), STALE.STABLE),
    project: (id: string) => intent(projectKeys.detail(id), () => projectsService.get(id), STALE.STABLE),
    invoice: (id: string) => intent(invoiceKeys.detail(id), () => invoicesService.get(id), STALE.LIVE),
  };
}

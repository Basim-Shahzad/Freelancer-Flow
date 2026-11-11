"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadBlob } from "@/components/settings/download";
import { portalInvoiceToView, portalMilestoneToView, portalProjectToView } from "@/lib/api/mappers/portal";
import type { MilestoneResponse } from "@/lib/api/portal.types";
import { portalService } from "@/lib/services/portal.service";

/** Keys never include the token, so it can't leak into devtools or cache dumps. */
export const portalKeys = {
  all: ["portal"] as const,
  project: (id: string) => [...portalKeys.all, "project", id] as const,
  milestone: (id: string) => [...portalKeys.all, "milestone", id] as const,
  invoice: (id: string) => [...portalKeys.all, "invoice", id] as const,
};

/**
 * The first invoice open stamps `viewedAt` and logs VIEWED, so portal reads never refetch on
 * focus/mount/reconnect and never retry or poll.
 */
const ONCE = {
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchInterval: false,
} as const;

export function usePortalProject(id: string, token: string | null) {
  return useQuery({ queryKey: portalKeys.project(id), queryFn: () => portalService.project(id, token!), enabled: !!token, select: portalProjectToView, ...ONCE });
}

export function usePortalMilestone(id: string, token: string | null) {
  return useQuery({ queryKey: portalKeys.milestone(id), queryFn: () => portalService.milestone(id, token!), enabled: !!token, select: (r: MilestoneResponse) => portalMilestoneToView(r), ...ONCE });
}

export function usePortalInvoice(id: string, token: string | null) {
  return useQuery({ queryKey: portalKeys.invoice(id), queryFn: () => portalService.invoice(id, token!), enabled: !!token, select: portalInvoiceToView, ...ONCE });
}

function useDecision(kind: "approve" | "reject", id: string, token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment?: string) => portalService[kind](id, token!, comment),
    // The response is the new milestone: write it in, don't refetch.
    onSuccess: (m) => qc.setQueryData(portalKeys.milestone(id), m),
  });
}
export const useApproveMilestone = (id: string, token: string | null) => useDecision("approve", id, token);
export const useRejectMilestone = (id: string, token: string | null) => useDecision("reject", id, token);

export function usePortalInvoicePdf(id: string, token: string | null, fileName: string) {
  return useMutation({
    mutationFn: async () => {
      downloadBlob(fileName, await portalService.invoicePdf(id, token!));
    },
  });
}

export function usePortalConvert(token: string | null) {
  return useMutation({ mutationFn: (password: string) => portalService.convert(token!, password) });
}

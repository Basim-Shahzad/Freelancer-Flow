"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { mapDashboardSummary } from "@/lib/api/mappers/dashboard";
import { useActivity } from "@/lib/hooks/activity";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { useInvoices } from "@/lib/hooks/invoices";
import { useProjectOptions } from "@/lib/hooks/projects";
import { dashboardService } from "@/lib/services/dashboard.service";
import { dashboardKeys } from "./keys";
import { STALE } from "@/lib/hooks/stale-times";

/** Server-computed figures, grouped by currency. Currency-less unbilled rows resolve through the project list. */
export function useDashboardSummary() {
  const { isAuthenticated } = useSession();
  const { byId } = useProjectOptions();
  const query = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: dashboardService.summary,
    enabled: isAuthenticated,
    staleTime: STALE.LIVE,
    placeholderData: keepPreviousData,
  });
  const data = useMemo(() => (query.data ? mapDashboardSummary(query.data, (id) => byId.get(id)?.currency) : undefined), [query.data, byId]);
  return { ...query, data };
}

const ATTENTION_LIMIT = 20;
const ACTIVITY_LIMIT = 6;

/**
 * The whole dashboard. Only the summary gates the screen (`isPending` / `isError`); recent invoices and activity
 * carry their own state so one failing card never blanks the rest.
 */
export function useDashboard() {
  const summary = useDashboardSummary();
  const overdue = useInvoices({ status: "overdue", limit: ATTENTION_LIMIT });
  const unpaid = useInvoices({ status: "unpaid", limit: ATTENTION_LIMIT });
  const draft = useInvoices({ status: "draft", limit: ATTENTION_LIMIT });
  const activity = useActivity({ limit: ACTIVITY_LIMIT });
  const attention = useMemo(() => ({
    invoices: [...(overdue.data?.invoices ?? []), ...(unpaid.data?.invoices ?? []), ...(draft.data?.invoices ?? [])],
    isPending: overdue.isPending || unpaid.isPending || draft.isPending,
    isError: overdue.isError || unpaid.isError || draft.isError,
    refetch: () => Promise.all([overdue.refetch(), unpaid.refetch(), draft.refetch()]),
  }), [overdue, unpaid, draft]);
  return {
    summary: summary.data,
    attention,
    activity,
    isPending: summary.isPending,
    isError: summary.isError,
    error: summary.error,
    refetch: () => Promise.all([summary.refetch(), attention.refetch(), activity.refetch()]),
  };
}

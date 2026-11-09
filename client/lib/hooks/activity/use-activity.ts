"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { activityService, type ActivityParams } from "@/lib/services/activity.service";

export const activityKeys = {
  all: ["activity"] as const,
  list: (params: ActivityParams) => ["activity", "list", params] as const,
};

/** One page of the audit feed, newest first. Pass `cursor` (the previous page's `nextCursor`) for older events. */
export function useActivity(params: ActivityParams = {}, enabled = true) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activityService.list(params),
    enabled: isAuthenticated && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { toActivityParams, type ActivityFilter } from "@/lib/api/mappers/activity";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { activityService, type ActivityParams } from "@/lib/services/activity.service";

export const activityKeys = {
  all: ["activity"] as const,
  feed: (filter: ActivityFilter) => ["activity", "feed", filter] as const,
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

export const ACTIVITY_PAGE = 50;

/** The activity log screen: server-filtered, newest first, paged with the response's `nextCursor`. */
export function useActivityFeed(filter: ActivityFilter) {
  const { isAuthenticated } = useSession();
  return useInfiniteQuery({
    queryKey: activityKeys.feed(filter),
    queryFn: ({ pageParam }) => activityService.list({ ...toActivityParams(filter), limit: ACTIVITY_PAGE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

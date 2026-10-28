"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiChangeRequestStatus, ChangeRequestCreate, ChangeRequestUpdate } from "@/lib/api/change-requests.types";
import { responseToChangeRequest } from "@/lib/api/mappers/change-requests";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { changeRequestsService } from "@/lib/services/change-requests.service";
import type { Currency } from "@/lib/types";

export interface ChangeRequestFilters {
  projectId?: string;
  status?: ApiChangeRequestStatus;
  skip?: number;
  limit?: number;
}

export const changeRequestKeys = {
  all: ["changeRequests"] as const,
  lists: () => [...changeRequestKeys.all, "list"] as const,
  list: (filters: ChangeRequestFilters) => [...changeRequestKeys.lists(), filters] as const,
  detail: (id: string) => [...changeRequestKeys.all, "detail", id] as const,
};

/**
 * Scope changes, server-filtered. `currency` is the project's, or a resolver by project id when the list spans
 * projects (dashboard).
 */
export function useChangeRequests(filters: ChangeRequestFilters, currency: Currency | ((projectId: string) => Currency), enabled = true) {
  const { isAuthenticated } = useSession();
  const { projectId, status, skip, limit } = filters;
  return useQuery({
    queryKey: changeRequestKeys.list(filters),
    queryFn: () => changeRequestsService.list({ project_id: projectId, status, skip, limit }),
    enabled: isAuthenticated && enabled,
    placeholderData: keepPreviousData,
    select: (res) => ({
      changeRequests: res.items.map((r) => responseToChangeRequest(r, typeof currency === "function" ? currency(r.projectId) : currency)),
      total: res.total,
    }),
  });
}

/** Decisions are audited, so the activity feed and project caches are refreshed too (when they are cached). */
function useInvalidateAfterChange() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: changeRequestKeys.all }),
    qc.invalidateQueries({ queryKey: ["activity"] }),
  ]);
}

export function useCreateChangeRequest() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({ mutationFn: (body: ChangeRequestCreate) => changeRequestsService.create(body), onSuccess: invalidate });
}

export function useUpdateChangeRequest() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ChangeRequestUpdate }) => changeRequestsService.patch(id, body),
    onSuccess: invalidate,
  });
}

/** PATCH `status` (+ `decisionNote`). Decisions are final: deciding twice is a 409 carrying the server `detail`. */
export function useDecideChangeRequest() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ChangeRequestUpdate }) => changeRequestsService.patch(id, body),
    onSuccess: invalidate,
    // A 409 means the list was stale; refresh it either way.
    onError: () => invalidate(),
  });
}

export function useDeleteChangeRequest() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({ mutationFn: (id: string) => changeRequestsService.remove(id), onSuccess: invalidate });
}

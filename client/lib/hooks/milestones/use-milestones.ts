"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { responseToMilestone } from "@/lib/api/mappers/milestones";
import type { MilestoneCreate, MilestoneResponse, MilestoneUpdate } from "@/lib/api/projects.types";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { projectKeys } from "@/lib/hooks/projects";
import { milestonesService } from "@/lib/services/milestones.service";
import type { Currency } from "@/lib/types";

export const milestoneKeys = {
  all: ["milestones"] as const,
  list: (projectId: string) => [...milestoneKeys.all, "list", projectId] as const,
};

/**
 * A project's milestones in `sortOrder`. Only fetch when the project has milestones enabled: creating one
 * while disabled is a 422, and the list is not meaningful then. `currency` is the project's.
 */
export function useMilestones(projectId: string | undefined, currency: Currency, enabled = true) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: milestoneKeys.list(projectId ?? ""),
    queryFn: () => milestonesService.list(projectId ?? ""),
    enabled: isAuthenticated && !!projectId && enabled,
    select: (rows) => rows.map((r) => responseToMilestone(r, currency)),
  });
}

/** Milestone changes move the project's progress, so its caches are refreshed too. */
function useInvalidateAfterChange(projectId: string) {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: milestoneKeys.list(projectId) }),
    qc.invalidateQueries({ queryKey: projectKeys.all }),
  ]);
}

export function useCreateMilestone(projectId: string) {
  const invalidate = useInvalidateAfterChange(projectId);
  return useMutation({
    mutationFn: (body: MilestoneCreate) => milestonesService.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateMilestone(projectId: string) {
  const invalidate = useInvalidateAfterChange(projectId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MilestoneUpdate }) => milestonesService.patch(id, body),
    onSuccess: invalidate,
  });
}

/** An invoiced milestone is refused by the server (409); surface its `detail`. */
export function useDeleteMilestone(projectId: string) {
  const invalidate = useInvalidateAfterChange(projectId);
  return useMutation({
    mutationFn: (id: string) => milestonesService.remove(id),
    onSuccess: invalidate,
  });
}

/** Asks the client for approval (the server emails them a portal link). A milestone already submitted/approved is a 409. */
export function useSubmitMilestone(projectId: string) {
  const invalidate = useInvalidateAfterChange(projectId);
  return useMutation({
    mutationFn: (id: string) => milestonesService.submit(id),
    onSuccess: invalidate,
  });
}

/** The rows in the requested id order, with `sortOrder` renumbered to match. */
export function applyOrder(rows: MilestoneResponse[], ids: string[]): MilestoneResponse[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id, i) => {
    const row = byId.get(id);
    return row ? [{ ...row, sortOrder: i }] : [];
  });
}

/** Optimistic reorder: the list updates at once and rolls back if the server refuses (e.g. a stale id list). */
export function useReorderMilestones(projectId: string) {
  const qc = useQueryClient();
  const key = milestoneKeys.list(projectId);
  return useMutation({
    mutationFn: (ids: string[]) => milestonesService.reorder(projectId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MilestoneResponse[]>(key);
      if (previous) qc.setQueryData<MilestoneResponse[]>(key, applyOrder(previous, ids));
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

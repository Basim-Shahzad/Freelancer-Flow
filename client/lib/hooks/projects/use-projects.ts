"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { responseToPeriod, responseToProject } from "@/lib/api/mappers/projects";
import { nextSkip, type ListResult } from "@/lib/api/pagination";
import type { ApiProjectStatus, ProjectCreate, ProjectResponse, ProjectUpdate } from "@/lib/api/projects.types";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { useBusiness } from "@/lib/hooks/profile";
import { projectsService } from "@/lib/services/projects.service";
import type { Currency, Project } from "@/lib/types";

export const PROJECTS_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 100;

export interface ProjectFilters {
  search?: string;
  clientId?: string;
  status?: ApiProjectStatus;
  limit?: number;
}

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  periods: (id: string) => [...projectKeys.all, "periods", id] as const,
  options: () => [...projectKeys.all, "options"] as const,
};

/** The profile currency, for projects whose own `currency` the API left null. */
function useFallbackCurrency(): Currency {
  return useBusiness().defaultCurrency;
}

/** Projects, server-side searched and filtered, paged with "Load more" (`skip` is the page param). */
export function useProjects(filters: ProjectFilters = {}) {
  const { isAuthenticated } = useSession();
  const { search, clientId, status, limit = PROJECTS_PAGE_SIZE } = filters;
  const fallback = useFallbackCurrency();
  return useInfiniteQuery({
    queryKey: projectKeys.list({ search, clientId, status, limit }),
    queryFn: ({ pageParam }) => projectsService.list({ skip: pageParam, limit, search, client_id: clientId, status }),
    initialPageParam: 0,
    getNextPageParam: nextSkip,
    placeholderData: keepPreviousData,
    enabled: isAuthenticated,
    select: (data) => ({
      projects: data.pages.flatMap((p) => p.items.map((i) => responseToProject(i, fallback))),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}

export function useProject(id: string | undefined) {
  const { isAuthenticated } = useSession();
  const fallback = useFallbackCurrency();
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    queryFn: () => projectsService.get(id ?? ""),
    enabled: isAuthenticated && !!id,
    select: (r) => responseToProject(r, fallback),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreate) => projectsService.create(body),
    onSuccess: (created) => {
      qc.setQueryData(projectKeys.detail(created.id), created);
      return qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectUpdate) => projectsService.patch(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(projectKeys.detail(id), updated);
      return qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/** DELETE /projects/{id}. A project with invoices is refused by the server (409); surface its `detail`. */
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
      qc.removeQueries({ queryKey: projectKeys.periods(id) });
      return qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/**
 * Billing periods of a RETAINER project, invoiced (`invoiceId`) vs not yet. Pass the project so each period
 * carries the retainer amount; the query only runs for retainer projects.
 */
export function useRetainerPeriods(project: Project | undefined) {
  const { isAuthenticated } = useSession();
  const enabled = isAuthenticated && project?.billingType === "retainer";
  const amount = project?.retainerAmount ?? 0;
  return useQuery({
    queryKey: projectKeys.periods(project?.id ?? ""),
    queryFn: () => projectsService.retainerPeriods(project?.id ?? ""),
    enabled,
    select: (periods) => periods.map((p) => responseToPeriod(p, amount)),
  });
}

async function fetchAllProjects(): Promise<ListResult<ProjectResponse>> {
  const items: ProjectResponse[] = [];
  let total = 0;
  do {
    const page = await projectsService.list({ skip: items.length, limit: OPTIONS_PAGE_SIZE });
    total = page.total;
    items.push(...page.items);
    if (page.items.length === 0) break;
  } while (items.length < total);
  return { items, total };
}

export interface ProjectOptions {
  projects: Project[];
  byId: Map<string, Project>;
  /** True until the first load finishes. */
  isLoading: boolean;
  isError: boolean;
}

const NONE: Project[] = [];

/**
 * Every project, for dropdowns and for resolving a `projectId` to a name on screens that have not been
 * migrated yet (time, invoices, dashboard). Pages through the list 100 at a time; cached and shared by all callers.
 */
export function useProjectOptions(): ProjectOptions {
  const { isAuthenticated } = useSession();
  const fallback = useFallbackCurrency();
  const query = useQuery({
    queryKey: projectKeys.options(),
    queryFn: fetchAllProjects,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
  const projects = useMemo(() => (query.data ? query.data.items.map((i) => responseToProject(i, fallback)) : NONE), [query.data, fallback]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  return { projects, byId, isLoading: query.isLoading, isError: query.isError };
}

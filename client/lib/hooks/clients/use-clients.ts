"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ClientCreate, ClientListItem, ClientUpdate } from "@/lib/api/clients.types";
import { listItemToClient, responseToClient, type ClientDefaults } from "@/lib/api/mappers/clients";
import { nextSkip, type ListParams, type ListResult } from "@/lib/api/pagination";
import { useBusiness } from "@/lib/hooks/profile";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { clientsService } from "@/lib/services/clients.service";
import type { Client } from "@/lib/types";

export const CLIENTS_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 100;

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (params: Omit<ListParams, "skip">) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  options: () => [...clientKeys.all, "options"] as const,
};

/** Profile-derived fallbacks for the fields the API leaves null (currency, payment terms). */
function useClientDefaults(): ClientDefaults {
  const { defaultCurrency, defaultTermsDays } = useBusiness();
  return useMemo(() => ({ currency: defaultCurrency, termsDays: defaultTermsDays }), [defaultCurrency, defaultTermsDays]);
}

/** Clients, server-side searched and paged with "Load more" (`skip` is the page param). */
export function useClients(params: { search?: string; limit?: number } = {}) {
  const { isAuthenticated } = useSession();
  const { search, limit = CLIENTS_PAGE_SIZE } = params;
  const defaults = useClientDefaults();
  return useInfiniteQuery({
    queryKey: clientKeys.list({ search, limit }),
    queryFn: ({ pageParam }) => clientsService.list({ skip: pageParam, limit, search }),
    initialPageParam: 0,
    getNextPageParam: nextSkip,
    placeholderData: keepPreviousData,
    enabled: isAuthenticated,
    select: (data) => ({
      clients: data.pages.flatMap((p) => p.items.map((i) => listItemToClient(i, defaults))),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}

/** One client with its full details (full tax id, address, notes, terms). */
export function useClient(id: string | undefined) {
  const { isAuthenticated } = useSession();
  const defaults = useClientDefaults();
  return useQuery({
    queryKey: clientKeys.detail(id ?? ""),
    queryFn: () => clientsService.get(id ?? ""),
    enabled: isAuthenticated && !!id,
    select: (r) => responseToClient(r, defaults),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientCreate) => clientsService.create(body),
    onSuccess: (created) => {
      qc.setQueryData(clientKeys.detail(created.id), created);
      return qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientUpdate) => clientsService.patch(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(clientKeys.detail(id), updated);
      return qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/** DELETE /clients/{id}. A client with projects or invoices is refused by the server (409); surface its `detail`. */
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsService.remove(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: clientKeys.detail(id) });
      return qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

async function fetchAllClients(): Promise<ListResult<ClientListItem>> {
  const items: ClientListItem[] = [];
  let total = 0;
  do {
    const page = await clientsService.list({ skip: items.length, limit: OPTIONS_PAGE_SIZE });
    total = page.total;
    items.push(...page.items);
    if (page.items.length === 0) break;
  } while (items.length < total);
  return { items, total };
}

export interface ClientOptions {
  /** Every client (list-item fields only: currency and terms are the profile defaults). */
  clients: Client[];
  byId: Map<string, Client>;
  /** True until the first load finishes. */
  isLoading: boolean;
  isError: boolean;
}

const NONE: Client[] = [];

/**
 * Every client, for dropdowns and for resolving a `clientId` to a name on screens that have not been
 * migrated yet. Pages through the list 100 at a time; cached and shared by all callers.
 */
export function useClientOptions(): ClientOptions {
  const { isAuthenticated } = useSession();
  const defaults = useClientDefaults();
  const query = useQuery({
    queryKey: clientKeys.options(),
    queryFn: fetchAllClients,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
  const clients = useMemo(() => (query.data ? query.data.items.map((i) => listItemToClient(i, defaults)) : NONE), [query.data, defaults]);
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  return { clients, byId, isLoading: query.isLoading, isError: query.isError };
}

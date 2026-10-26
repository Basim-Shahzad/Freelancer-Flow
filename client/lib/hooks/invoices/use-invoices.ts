"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { InvoiceResponse, PaymentCreate, ShareChannel } from "@/lib/api/invoices.types";
import { responseToEvent, responseToInvoice, responseToShare, STATUS_TO_API } from "@/lib/api/mappers/invoices";
import type { ListResult } from "@/lib/api/pagination";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { projectKeys } from "@/lib/hooks/projects";
import { timeKeys } from "@/lib/hooks/time-entries/keys";
import { invoicesService } from "@/lib/services/invoices.service";
import type { InvoiceDetail, InvoiceStatus } from "@/lib/types";

export const INVOICES_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 100;

export type InvoiceStatusFilter = InvoiceStatus | "all";

export interface InvoiceFilters {
  /** Invoice number. */
  search?: string;
  clientId?: string;
  projectId?: string;
  /** `unpaid` covers both sent and partially paid invoices (the server has no single value for it). */
  status?: InvoiceStatusFilter;
  limit?: number;
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  events: (id: string) => [...invoiceKeys.all, "events", id] as const,
  options: () => [...invoiceKeys.all, "options"] as const,
};

/** Keys other domains own; matched by prefix so this file does not depend on their (not yet migrated) hooks. */
const ACTIVITY_KEY = ["activity"] as const;
const DASHBOARD_KEY = ["dashboard"] as const;

/** One page of the list, plus the offsets the next page starts at (two for `unpaid`, which merges two server filters). */
interface InvoicePage extends ListResult<InvoiceResponse> {
  next: { skip: number; partial: number };
}

const byNewest = (a: InvoiceResponse, b: InvoiceResponse) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/**
 * Fetches one page. `unpaid` has no single server status (SENT and PARTIALLY_PAID both exclude overdue), so it asks
 * for both and merges them, each advancing its own offset.
 */
async function fetchPage(filters: InvoiceFilters, cursor: InvoicePage["next"]): Promise<InvoicePage> {
  const { search, clientId, projectId, status = "all", limit = INVOICES_PAGE_SIZE } = filters;
  const base = { limit, search, client_id: clientId, project_id: projectId };
  if (status === "unpaid") {
    const [sent, partial] = await Promise.all([
      invoicesService.list({ ...base, skip: cursor.skip, status: "SENT" }),
      invoicesService.list({ ...base, skip: cursor.partial, status: "PARTIALLY_PAID" }),
    ]);
    return {
      items: [...sent.items, ...partial.items].sort(byNewest),
      total: sent.total + partial.total,
      next: { skip: cursor.skip + sent.items.length, partial: cursor.partial + partial.items.length },
    };
  }
  const page = await invoicesService.list({ ...base, skip: cursor.skip, status: status === "all" ? undefined : STATUS_TO_API[status] });
  return { ...page, next: { skip: cursor.skip + page.items.length, partial: 0 } };
}

/** Invoices, server-side searched and filtered, paged with "Load more". */
export function useInvoices(filters: InvoiceFilters = {}) {
  const { isAuthenticated } = useSession();
  const { search, clientId, projectId, status, limit = INVOICES_PAGE_SIZE } = filters;
  const key = { search, clientId, projectId, status, limit };
  return useInfiniteQuery({
    queryKey: invoiceKeys.list(key),
    queryFn: ({ pageParam }) => fetchPage(key, pageParam),
    initialPageParam: { skip: 0, partial: 0 },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return last.items.length > 0 && loaded < last.total ? last.next : undefined;
    },
    placeholderData: keepPreviousData,
    enabled: isAuthenticated,
    select: (data) => ({
      invoices: data.pages.flatMap((p) => p.items.map(responseToInvoice)),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}

export function useInvoice(id: string | undefined) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ""),
    queryFn: () => invoicesService.get(id ?? ""),
    enabled: isAuthenticated && !!id,
    select: responseToInvoice,
  });
}

/** Lifecycle events, oldest first (the server's order). */
export function useInvoiceEvents(id: string | undefined) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: invoiceKeys.events(id ?? ""),
    queryFn: () => invoicesService.events(id ?? ""),
    enabled: isAuthenticated && !!id,
    select: (events) => events.map(responseToEvent),
  });
}

async function fetchAllInvoices(): Promise<ListResult<InvoiceResponse>> {
  const items: InvoiceResponse[] = [];
  let total = 0;
  do {
    const page = await invoicesService.list({ skip: items.length, limit: OPTIONS_PAGE_SIZE });
    total = page.total;
    items.push(...page.items);
    if (page.items.length === 0) break;
  } while (items.length < total);
  return { items, total };
}

const NONE: InvoiceDetail[] = [];

/** Every invoice, for screens that need to resolve or total them all (pages 100 at a time; cached and shared). */
export function useInvoiceOptions() {
  const { isAuthenticated } = useSession();
  const query = useQuery({ queryKey: invoiceKeys.options(), queryFn: fetchAllInvoices, enabled: isAuthenticated, staleTime: 5 * 60_000 });
  const invoices = useMemo(() => (query.data ? query.data.items.map(responseToInvoice) : NONE), [query.data]);
  const byId = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  return { invoices, byId, isLoading: query.isLoading, isError: query.isError };
}

/* ---------------------------------------------------------------- mutations */

/**
 * After any action that changes an invoice: store the returned invoice, then refresh the list, the events and the
 * activity feed and dashboard (money and status moved). `time` is refreshed too when time entries were released.
 */
function settle(qc: QueryClient, invoice: InvoiceResponse, opts: { time?: boolean } = {}) {
  qc.setQueryData(invoiceKeys.detail(invoice.id), invoice);
  const keys: readonly (readonly unknown[])[] = [invoiceKeys.lists(), invoiceKeys.events(invoice.id), invoiceKeys.options(), ACTIVITY_KEY, DASHBOARD_KEY];
  const all = opts.time ? [...keys, timeKeys.all, projectKeys.all] : keys;
  return Promise.all(all.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

interface ChannelVars {
  id: string;
  channel: ShareChannel;
}

/**
 * POST /invoices/{id}/send. A draft moves to sent for every channel; only `email` sends mail. Idempotent on an
 * already-sent invoice (same links, nothing changes). `emailDelivered === false` means the status moved but the
 * email did not go out.
 */
export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, channel }: ChannelVars) => {
      const res = await invoicesService.send(id, channel);
      void settle(qc, res.invoice);
      return responseToShare(res);
    },
  });
}

/** POST /invoices/{id}/remind: sent, unpaid invoices only; one per 24 h (409 / 429 otherwise). */
export function useRemindInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, channel }: ChannelVars) => {
      const res = await invoicesService.remind(id, channel);
      void settle(qc, res.invoice);
      return responseToShare(res);
    },
  });
}

/** GET /invoices/{id}/share: fresh client links for any issued invoice. Changes nothing, so no cache is touched. */
export function useShareLinks() {
  return useMutation({ mutationFn: (id: string) => invoicesService.share(id) });
}

/** A mutation that returns the updated invoice and settles the caches with it. */
function useInvoiceAction<V>(call: (vars: V) => Promise<InvoiceResponse>, opts: { time?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      const res = await call(vars);
      void settle(qc, res, opts);
      return responseToInvoice(res);
    },
  });
}

/** POST /invoices/{id}/cancel: not allowed with payments (void them first). Releases the invoice's time entries. */
export function useCancelInvoice() {
  return useInvoiceAction((id: string) => invoicesService.cancel(id), { time: true });
}

export function useWriteOffInvoice() {
  return useInvoiceAction(({ id, reason }: { id: string; reason: string }) => invoicesService.writeOff(id, reason));
}

export function useReverseWriteOff() {
  return useInvoiceAction((id: string) => invoicesService.reverseWriteOff(id));
}

export function useRecordPayment() {
  return useInvoiceAction(({ id, body }: { id: string; body: PaymentCreate }) => invoicesService.recordPayment(id, body));
}

export function useVoidPayment() {
  return useInvoiceAction(({ id, paymentId }: { id: string; paymentId: string }) => invoicesService.voidPayment(id, paymentId));
}

/** GET /invoices/{id}/pdf as a Blob (authenticated; the client gets the token-based `pdfUrl` instead). */
export function useInvoicePdf() {
  return useMutation({ mutationFn: (id: string) => invoicesService.pdf(id) });
}

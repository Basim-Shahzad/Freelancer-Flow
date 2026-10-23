"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { toPaymentMethod } from "@/lib/api/mappers/payment-methods";
import type { PaymentMethodCreate, PaymentMethodResponse, PaymentMethodUpdate } from "@/lib/api/payment-methods.types";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { paymentMethodsService } from "@/lib/services/payment-methods.service";

/**
 * Payment method `details` hold IBANs and wallet numbers. They live in react-query memory only (nothing here is
 * persisted), and must never be logged or put in a URL.
 */
export const paymentMethodKeys = {
  all: ["paymentMethods"] as const,
  lists: () => [...paymentMethodKeys.all, "list"] as const,
  list: (includeInactive: boolean) => [...paymentMethodKeys.lists(), { includeInactive }] as const,
  details: () => [...paymentMethodKeys.all, "detail"] as const,
  detail: (id: string) => [...paymentMethodKeys.details(), id] as const,
};

/** The caller's methods in `sortOrder`. Inactive ones are included by default (Settings needs them; invoices filter on `enabled`). */
export function usePaymentMethods({ includeInactive = true }: { includeInactive?: boolean } = {}) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: paymentMethodKeys.list(includeInactive),
    queryFn: () => paymentMethodsService.list(includeInactive),
    enabled: isAuthenticated,
    select: (items) => items.map(toPaymentMethod),
  });
}

export function usePaymentMethod(id: string | undefined) {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: paymentMethodKeys.detail(id ?? ""),
    queryFn: () => paymentMethodsService.get(id ?? ""),
    enabled: isAuthenticated && !!id,
    select: toPaymentMethod,
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentMethodCreate) => paymentMethodsService.create(body),
    onSuccess: (created) => {
      qc.setQueryData(paymentMethodKeys.detail(created.id), created);
      return qc.invalidateQueries({ queryKey: paymentMethodKeys.lists() });
    },
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PaymentMethodUpdate }) => paymentMethodsService.patch(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(paymentMethodKeys.detail(updated.id), updated);
      return qc.invalidateQueries({ queryKey: paymentMethodKeys.lists() });
    },
  });
}

/** DELETE. The server soft-deletes a method that invoice snapshots reference, so refetch instead of dropping it from the cache. */
export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentMethodsService.remove(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: paymentMethodKeys.detail(id) });
      return qc.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}

type Snapshot = [QueryKey, PaymentMethodResponse[] | undefined][];

/** Applies `update` to every cached list right away; returns what to restore if the request fails. */
async function applyOptimistic(qc: QueryClient, update: (list: PaymentMethodResponse[]) => PaymentMethodResponse[]): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: paymentMethodKeys.lists() });
  const previous = qc.getQueriesData<PaymentMethodResponse[]>({ queryKey: paymentMethodKeys.lists() });
  qc.setQueriesData<PaymentMethodResponse[]>({ queryKey: paymentMethodKeys.lists() }, (old) => (old ? update(old) : old));
  return previous;
}

const rollback = (qc: QueryClient, previous: Snapshot | undefined) => previous?.forEach(([key, data]) => qc.setQueryData(key, data));

/** PUT /order with every id exactly once. Optimistic, rolled back on failure. */
export function useReorderPaymentMethods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => paymentMethodsService.reorder(ids),
    onMutate: (ids) =>
      applyOptimistic(qc, (list) => {
        const byId = new Map(list.map((m) => [m.id, m]));
        const ordered = ids.flatMap((id, i) => { const m = byId.get(id); return m ? [{ ...m, sortOrder: i }] : []; });
        // Keep anything the new order does not mention (e.g. a filtered list) after the ordered ones.
        return [...ordered, ...list.filter((m) => !ids.includes(m.id))];
      }),
    onError: (_e, _ids, previous) => rollback(qc, previous),
    onSettled: () => qc.invalidateQueries({ queryKey: paymentMethodKeys.lists() }),
  });
}

/** Makes one method the only default. An inactive method is activated at the same time. Optimistic with rollback. */
export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      paymentMethodsService.patch(id, isActive ? { isDefault: true } : { isDefault: true, isActive: true }),
    onMutate: ({ id }) => applyOptimistic(qc, (list) => list.map((m) => (m.id === id ? { ...m, isDefault: true, isActive: true } : { ...m, isDefault: false }))),
    onError: (_e, _vars, previous) => rollback(qc, previous),
    onSettled: () => qc.invalidateQueries({ queryKey: paymentMethodKeys.all }),
  });
}

/** Shows or hides a method on invoices (`isActive`). Optimistic with rollback. */
export function useTogglePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => paymentMethodsService.patch(id, { isActive }),
    onMutate: ({ id, isActive }) => applyOptimistic(qc, (list) => list.map((m) => (m.id === id ? { ...m, isActive } : m))),
    onError: (_e, _vars, previous) => rollback(qc, previous),
    onSettled: () => qc.invalidateQueries({ queryKey: paymentMethodKeys.all }),
  });
}

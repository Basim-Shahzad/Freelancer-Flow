"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { StateBlock } from "@/components/domain/state-block";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";

interface Props<T> {
  query: Pick<UseQueryResult<T>, "data" | "isPending" | "isError" | "error" | "refetch" | "isFetching">;
  /** Rendered with the data once loaded and non-empty. */
  children: (data: T) => React.ReactNode;
  /** Return true when the loaded data counts as "empty". Defaults to empty arrays / `{ items: [] }`. */
  isEmpty?: (data: T) => boolean;
  loading?: React.ReactNode;
  empty?: React.ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  emptyCta?: { label: string; href?: string; onClick?: () => void };
}

const defaultIsEmpty = (data: unknown): boolean => {
  if (Array.isArray(data)) return data.length === 0;
  const items = (data as { items?: unknown } | null | undefined)?.items;
  return Array.isArray(items) && items.length === 0;
};

/** Handles loading / error (with retry) / offline / 404 / empty for a react-query result, then renders children. */
export function QueryBoundary<T>({ query, children, isEmpty = defaultIsEmpty, loading, empty, emptyTitle, emptyBody, emptyCta }: Props<T>) {
  const online = useAppStore((s) => s.online);
  const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };

  if (query.isPending) {
    if (!online) return <StateBlock kind="offline" cta={retry} />;
    return <>{loading ?? <div role="status" aria-label="Loading"><Skeleton className="h-40 w-full" /></div>}</>;
  }
  if (query.isError) {
    if (!online) return <StateBlock kind="offline" cta={retry} />;
    if (getApiErrorStatus(query.error) === 404) {
      return <StateBlock kind="error" title="Not found" body="This item doesn’t exist or was removed." />;
    }
    return <StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} />;
  }
  const { data } = query;
  if (data === undefined) return null;
  if (isEmpty(data)) return <>{empty ?? <StateBlock kind="empty" title={emptyTitle} body={emptyBody} cta={emptyCta} />}</>;
  return <>{children(data)}</>;
}

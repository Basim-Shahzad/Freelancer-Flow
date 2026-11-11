import { QueryClient } from "@tanstack/react-query";
import { classifyApiError } from "@/lib/api/errors";

export const MAX_QUERY_RETRIES = 2;

/** Retry only transient failures (5xx, network); never 4xx — that includes 429 — and at most twice. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  const { kind } = classifyApiError(error);
  return kind === "server" || kind === "offline";
}

export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);

/**
 * Queries are offline-first (cached data renders offline, the fetch pauses instead of failing). Mutations are
 * online-only: they pause and surface a clear error rather than queueing silently — the time outbox is the only
 * offline writer.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { networkMode: "online", retry: false },
    },
  });
}

import axios from "axios";

export type ApiErrorKind = "offline" | "rateLimited" | "notFound" | "unauthorized" | "conflict" | "validation" | "server" | "unknown";

export interface ClassifiedError {
  kind: ApiErrorKind;
  status?: number;
  /** Seconds from a `Retry-After` header (429 only), when present and numeric. */
  retryAfter?: number;
}

/** Reads `Retry-After` (delta-seconds form) from an axios response header bag. */
function parseRetryAfter(headers: unknown): number | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const h = headers as { get?: (k: string) => unknown } & Record<string, unknown>;
  const raw = typeof h.get === "function" ? h.get("retry-after") : (h["retry-after"] ?? h["Retry-After"]);
  const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Pure classification of anything a query/mutation can throw. */
export function classifyApiError(error: unknown): ClassifiedError {
  if (!axios.isAxiosError(error)) return { kind: "unknown" };
  if (!error.response) return { kind: "offline" };
  const status = error.response.status;
  if (status === 429) return { kind: "rateLimited", status, retryAfter: parseRetryAfter(error.response.headers) };
  if (status === 404) return { kind: "notFound", status };
  if (status === 401) return { kind: "unauthorized", status };
  if (status === 409) return { kind: "conflict", status };
  if (status === 422) return { kind: "validation", status };
  if (status >= 500) return { kind: "server", status };
  return { kind: "unknown", status };
}

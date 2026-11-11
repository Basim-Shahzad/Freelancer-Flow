"use client";

import { useState } from "react";

/** In-memory only (module scope, per page path). Survives strict-mode double render after the URL was stripped. */
const seen = new Map<string, string>();

/** Test helper. */
export const resetPortalTokens = () => seen.clear();

/**
 * Reads the portal JWT from `?token=` once, keeps it in memory only and strips it from the URL so it
 * isn't kept in browser history. Never logged, never written to storage.
 */
export function usePortalToken(): string | null {
  const [token] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");
    if (t) {
      seen.set(url.pathname, t);
      url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return seen.get(url.pathname) ?? null;
  });
  return token;
}

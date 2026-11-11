"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { classifyApiError } from "@/lib/api/errors";
import { getApiErrorMessage } from "@/lib/services/api.service";

/** Consistent success/error toasts for mutations. */
export function useApiToast() {
  const success = useCallback((message: string) => toast.success(message), []);
  const error = useCallback((err: unknown, fallback?: string) => {
    const k = classifyApiError(err).kind;
    const msg = k === "rateLimited" || k === "server" || k === "offline" ? getApiErrorMessage(err) : getApiErrorMessage(err, fallback);
    toast.error(msg);
  }, []);
  return { success, error };
}

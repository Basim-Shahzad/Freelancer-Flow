"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/services/api.service";

/** Consistent success/error toasts for mutations. */
export function useApiToast() {
  const success = useCallback((message: string) => toast.success(message), []);
  const error = useCallback((err: unknown, fallback?: string) => toast.error(getApiErrorMessage(err, fallback)), []);
  return { success, error };
}

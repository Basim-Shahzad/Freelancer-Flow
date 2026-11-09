"use client";

import { useMutation } from "@tanstack/react-query";
import { downloadBlob } from "@/components/settings/download";
import { exportService } from "@/lib/services/export.service";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";

/** Maps an export failure to dialog copy. 401/403 = wrong password. */
export function exportErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);
  if (status === 401 || status === 403) return "That password isn’t right. Try again.";
  if (status === 429) return "Too many exports. Try again later.";
  return getApiErrorMessage(error, "Couldn’t prepare your export. Try again.");
}

/** Requests the archive and saves it as a file. */
export function useExportData() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { blob, fileName } = await exportService.download(password);
      downloadBlob(fileName, blob);
      return fileName;
    },
  });
}

import { todayISO } from "@/lib/dates";
import { api } from "./api.service";

export const exportFileName = (date: string = todayISO()) => `paylancr-export-${date}.zip`;

export const exportService = {
  /** The password is re-verified server-side. Resolves with the ZIP blob and its file name. */
  download: (password: string) =>
    api.post<Blob>("/export", { password }, { responseType: "blob" }).then((r) => ({ blob: r.data, fileName: exportFileName() })),
};

import axios from "axios";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Maps a FastAPI 422 body onto react-hook-form fields (`loc: ["body", "full_name"]` -> `fullName`).
 * Errors that match no known field become a root error. Returns true when the error was a 422 and has been applied.
 */
export function applyApiFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): boolean {
  if (getApiErrorStatus(error) !== 422 || !axios.isAxiosError(error)) return false;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  if (!Array.isArray(detail)) {
    form.setError("root", { type: "server", message: getApiErrorMessage(error) });
    return true;
  }
  const known = new Set(Object.keys(form.getValues()));
  const unmatched: string[] = [];
  let focused = false;
  for (const item of detail as ValidationItem[]) {
    const path = (item.loc ?? []).filter((p) => p !== "body" && p !== "query");
    const message = item.msg ?? "Invalid value";
    const name = path.map((p) => (typeof p === "string" ? camel(p) : String(p))).join(".");
    if (path.length > 0 && known.has(camel(String(path[0])))) {
      form.setError(name as Path<T>, { type: "server", message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmatched.push(message);
    }
  }
  if (unmatched.length) form.setError("root", { type: "server", message: unmatched.join(" ") });
  return true;
}

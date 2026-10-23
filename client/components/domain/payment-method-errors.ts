import axios from "axios";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";

export interface MethodErrors {
  /** Field key (the API's camelCase `details` key, or `label`) -> message. */
  fields: Record<string, string>;
  /** Anything that could not be tied to a field, e.g. "provide accountEmail and/or paymentRequestUrl". */
  general?: string;
}

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const clean = (s: string) => s.replace(/^Value error,\s*/i, "").trim();

/** "swift_bic is required for scheme SWIFT_OTHER" -> a message that reads well under the field. */
function friendly(msg: string): string {
  if (/^is required for scheme/.test(msg)) return "Required for this account type";
  if (/^is not used by scheme/.test(msg)) return "Not used by this account type";
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

/** Last segment of a dotted key, camelised: `details.swift_bic` -> `swiftBic`. */
const keyOf = (raw: string) => camel(raw.split(".").at(-1) ?? raw);

/**
 * The server validates `details` in one pass and reports every problem in one message:
 * `"iban: invalid IBAN checksum; swift_bic is required for scheme SWIFT_OTHER"` (keys may be snake_case when the
 * message is hand-built). Splits that back into per-field messages.
 */
function parseMessage(text: string): { key?: string; msg: string }[] {
  return clean(text)
    .split(/;\s+/)
    .filter(Boolean)
    .map((part) => {
      const keyed = /^([A-Za-z_][\w.]*):\s+(.+)$/.exec(part);
      if (keyed) return { key: keyOf(keyed[1]!), msg: friendly(keyed[2]!) };
      const scheme = /^([a-z][a-z_]*)\s+(is (?:required for|not used by) scheme .+)$/.exec(part);
      if (scheme) return { key: keyOf(scheme[1]!), msg: friendly(scheme[2]!) };
      return { msg: friendly(part) };
    });
}

/**
 * Maps a payment-method 422 onto form fields. Works from FastAPI's `{ detail: [{ loc, msg }] }` and from a plain
 * `{ detail: "key: msg; ..." }`. `known` limits field errors to keys the form shows; the rest become `general`.
 * Returns null when the error is not a 422.
 */
export function mapMethodErrors(error: unknown, known?: Iterable<string>): MethodErrors | null {
  if (getApiErrorStatus(error) !== 422 || !axios.isAxiosError(error)) return null;
  const allowed = known ? new Set(known) : undefined;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  const fields: Record<string, string> = {};
  const general: string[] = [];
  const add = (key: string | undefined, msg: string) => {
    if (key && (!allowed || allowed.has(key))) fields[key] ??= msg;
    else if (!general.includes(msg)) general.push(msg);
  };

  if (Array.isArray(detail)) {
    for (const item of detail as ValidationItem[]) {
      const path = (item.loc ?? []).filter((p): p is string => typeof p === "string" && p !== "body" && p !== "query" && p !== "details");
      const locKey = path.length ? keyOf(path.join(".")) : undefined;
      const parsed = parseMessage(item.msg ?? "Invalid value");
      for (const p of parsed) add(p.key ?? locKey, p.msg);
    }
  } else if (typeof detail === "string") {
    for (const p of parseMessage(detail)) add(p.key, p.msg);
  } else {
    general.push(getApiErrorMessage(error));
  }
  return { fields, general: general.length ? general.join(" ") : undefined };
}

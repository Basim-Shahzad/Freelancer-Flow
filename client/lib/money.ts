import type { Currency } from "./types";

/** PKR is shown without decimals (as in the design); other currencies show 2. */
export function fractionDigits(currency: Currency): number {
  return currency === "PKR" ? 0 : 2;
}

/** "1,250.00" / "185,000" — no currency code. */
export function formatAmount(minor: number, currency: Currency): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}

/** "USD 1,250.00" — code first, as printed on invoices. */
export function formatMoney(minor: number, currency: Currency): string {
  return `${currency} ${formatAmount(minor, currency)}`;
}

/** Split into integer and decimal parts for big-serif rendering. */
export function amountParts(minor: number, currency: Currency): { int: string; dec: string } {
  const s = formatAmount(Math.abs(minor), currency);
  const i = s.indexOf(".");
  const sign = minor < 0 ? "−" : "";
  return i < 0 ? { int: sign + s, dec: "" } : { int: sign + s.slice(0, i), dec: s.slice(i) };
}

/** Parse user input like "1,250.5" or "1250" into minor units. Returns null if invalid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Minutes to "1h 30m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Hours with one decimal: 7.5 h */
export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

/** Parse "1.5", "1:30", "90m", "1h 30m" into minutes. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 60);
  return null;
}

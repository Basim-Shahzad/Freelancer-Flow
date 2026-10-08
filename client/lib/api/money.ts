import { fractionDigits } from "@/lib/money";
import type { Currency } from "@/lib/types";

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * API decimal string ("1250.50") -> integer minor units (125050). Pure string/BigInt arithmetic, no floats.
 * Digits beyond the currency exponent are rounded half away from zero (the API normally sends exact values).
 */
export function toMinor(decimal: string | number, currency: Currency): number {
  const raw = typeof decimal === "number" ? String(decimal) : decimal.trim();
  const m = DECIMAL.exec(raw);
  if (!m) throw new RangeError(`Invalid decimal amount: "${raw}"`);
  const [, sign, int = "0", frac = ""] = m;
  const digits = fractionDigits(currency);
  let minor = BigInt(int + frac.slice(0, digits).padEnd(digits, "0"));
  if (frac.length > digits && Number(frac[digits]) >= 5) minor += BigInt(1);
  const n = Number(minor);
  if (!Number.isSafeInteger(n)) throw new RangeError(`Amount out of range: "${raw}"`);
  return sign && n !== 0 ? -n : n;
}

/** Integer minor units -> API decimal string, always with the currency's fixed number of decimals. */
export function toDecimal(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Minor units must be a safe integer, got ${minor}`);
  const digits = fractionDigits(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = String(Math.abs(minor));
  if (digits === 0) return sign + abs;
  const padded = abs.padStart(digits + 1, "0");
  return `${sign}${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}

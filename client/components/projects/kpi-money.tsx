import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { splitByCurrency, type ByCurrency } from "./rate";

/** KPI value for per-currency figures: the default currency's number up front, other currencies in a quiet second line (never added together). */
export function KpiMoney({ by, base, fallback }: { by: ByCurrency; base: Currency; fallback?: Currency }) {
  const { primary, others } = splitByCurrency(by, base);
  const [cur, amount] = primary ?? [fallback ?? base, 0];
  return (
    <>
      {formatMoney(amount, cur)}
      {others.length > 0 && (
        <span className="mt-1 block font-sans text-xs font-normal tracking-normal text-muted-foreground">
          also {others.map(([c, a]) => formatMoney(a, c)).join(" · ")}
        </span>
      )}
    </>
  );
}

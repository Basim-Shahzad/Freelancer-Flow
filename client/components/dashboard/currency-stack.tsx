import { Money } from "@/components/domain/money";
import type { Currency } from "@/lib/types";
import { currencyEntries, estimateTarget, type ByCurrency } from "./aggregate";

/**
 * Per-currency amounts, one Money per currency (never summed across currencies).
 * With `estimateBase`, each figure also shows a labelled reference-rate estimate in the other currency.
 */
export function CurrencyStack({ by, size = "md", fallback, estimateBase, note, align = "start" }: {
  by: ByCurrency; size?: "lg" | "md" | "sm"; fallback: Currency; estimateBase?: Currency; note?: boolean; align?: "start" | "end";
}) {
  const entries = currencyEntries(by);
  if (entries.length === 0) return <Money amount={0} currency={fallback} size={size} align={align} />;
  return (
    <div className="flex flex-col gap-3">
      {entries.map(([cur, amount], i) => (
        <Money key={cur} amount={amount} currency={cur} size={size} align={align} estimateIn={estimateBase ? estimateTarget(cur, estimateBase) : undefined} note={note && i === 0} />
      ))}
    </div>
  );
}

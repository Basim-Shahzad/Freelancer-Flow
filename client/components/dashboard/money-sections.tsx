import { format } from "date-fns";
import { Money } from "@/components/domain/money";
import { Card, CardBody, CardFoot, CardHead } from "@/components/ui/section";
import { FX_DISCLAIMER } from "@/lib/fx";
import type { Currency } from "@/lib/types";
import { parse } from "@/lib/dates";
import { currencyEntries, estimateTarget, type ByCurrency } from "./aggregate";

/** Cash in: recorded payments this month vs last month, per currency. */
export function CashSection({ thisMonth, lastMonth, today, base }: { thisMonth: ByCurrency; lastMonth: ByCurrency; today: string; base: Currency }) {
  const rows = [...new Set([...currencyEntries(thisMonth), ...currencyEntries(lastMonth)].map(([c]) => c))];
  const monthName = (offset: number) => format(new Date(parse(today).getFullYear(), parse(today).getMonth() + offset, 1), "MMMM");
  const firstWithValue = rows.find((c) => (thisMonth[c] ?? 0) > 0);
  return (
    <Card>
      <CardHead title="Cash in" sub="Recorded payments only, this month against last" />
      <CardBody>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded in {monthName(0)} or {monthName(-1)} yet. Record a payment on an invoice and it appears here.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border pb-2 @2xl:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]" aria-hidden="true">
            <span className="hidden @2xl:block" />
            <span className="t-eyebrow">{monthName(0)} · so far</span>
            <span className="t-eyebrow">{monthName(-1)}</span>
          </div>
          {rows.map((cur) => (
            <div key={cur} role="group" aria-label={`${cur} cash in`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-border py-4 @2xl:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="col-span-full text-xs text-muted-foreground @2xl:col-span-1 @2xl:pt-2">{cur === "USD" ? "US dollars" : cur === "PKR" ? "Pakistani rupees" : cur}</span>
              <div><span className="sr-only">{monthName(0)}: </span><Money amount={thisMonth[cur] ?? 0} currency={cur} size="lg" estimateIn={estimateTarget(cur, base)} note={cur === firstWithValue} /></div>
              <div><span className="sr-only">{monthName(-1)}: </span><Money amount={lastMonth[cur] ?? 0} currency={cur} size="lg" estimateIn={estimateTarget(cur, base)} /></div>
            </div>
          ))}
        </div>
      )}
      </CardBody>
      <CardFoot><span>{FX_DISCLAIMER}. Tax is not deducted from these figures.</span></CardFoot>
    </Card>
  );
}

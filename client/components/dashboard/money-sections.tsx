import Link from "next/link";
import { format } from "date-fns";
import { Money } from "@/components/domain/money";
import { Card, CardBody, CardFoot, CardHead } from "@/components/ui/section";
import { FX_DISCLAIMER } from "@/lib/fx";
import type { Currency } from "@/lib/types";
import { formatHours, formatMoney } from "@/lib/money";
import { parse } from "@/lib/dates";
import type { DashboardView } from "@/lib/api/mappers/dashboard";
import { currencyEntries, estimateTarget } from "./aggregate";

/** Cash in: recorded payments this month vs last month, per currency. */
export function CashSection({ cashIn, base }: { cashIn: DashboardView["cashIn"]; base: Currency }) {
  const { thisMonth, lastMonth } = cashIn;
  const rows = [...new Set([...currencyEntries(thisMonth), ...currencyEntries(lastMonth)].map(([c]) => c))];
  const monthName = (offset: number) => {
    const start = offset === 0 ? cashIn.thisMonthStart : cashIn.lastMonthStart;
    return start ? format(parse(start), "MMMM") : offset === 0 ? "this month" : "last month";
  };
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
      <CardFoot><span>{FX_DISCLAIMER} Tax is not deducted from these figures.</span></CardFoot>
    </Card>
  );
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** Work done but not yet on an invoice, per currency. Each row opens the create-invoice flow for its project. */
export function UnbilledSection({ unbilled }: { unbilled: DashboardView["unbilled"] }) {
  const rows = [
    ...unbilled.time.map((t) => ({ key: `t-${t.projectId}`, href: `/invoices/new?projectId=${t.projectId}`, name: t.projectName, line: `${formatHours(t.minutes)} of time`, amount: t.amount, currency: t.currency })),
    ...unbilled.milestones.map((m) => ({ key: `m-${m.projectId}`, href: `/invoices/new?projectId=${m.projectId}`, name: m.projectName, line: `${plural(m.count, "milestone")} ready`, amount: m.amount, currency: m.currency })),
    ...unbilled.retainerPeriods.map((r) => ({ key: `r-${r.projectId}-${r.periodStart}`, href: `/invoices/new?projectId=${r.projectId}&period=${r.periodStart}`, name: r.projectName, line: `Retainer · ${r.label}`, amount: r.amount, currency: r.currency })),
  ];
  return (
    <Card>
      <CardHead title="Not billed yet" sub="Ready to invoice, in each project’s own currency (estimates)" />
      <CardBody className="py-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting to be billed. Logged time, completed milestones and retainer periods show up here.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="flex min-h-11 items-center justify-between gap-4 border-b border-border py-3 text-inherit no-underline hover:bg-hover">
                  <span className="min-w-0"><span className="block font-medium leading-snug">{r.name}</span><span className="block text-xs text-muted-foreground">{r.line}</span></span>
                  <span className="num text-sm" aria-label={`About ${formatMoney(r.amount, r.currency)}`}>≈ {formatMoney(r.amount, r.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

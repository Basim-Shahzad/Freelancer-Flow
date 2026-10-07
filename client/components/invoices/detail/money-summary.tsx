import { CardBody, CardHead } from "@/components/ui/section";
import type { InvoiceTotals } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

/** Key/values in the invoice's own currency. Nothing is summed across currencies. */
export function MoneySummary({ totals, currency, taxPercent }: { totals: InvoiceTotals; currency: Currency; taxPercent: number }) {
  const rows: [string, string][] = [
    ["Subtotal, net of discount", formatMoney(totals.taxable, currency)],
    [`Tax (${taxPercent}%)`, formatMoney(totals.tax, currency)],
    ["Paid so far", formatMoney(totals.paid, currency)],
    ["Balance", formatMoney(totals.balance, currency)],
  ];
  return (
    <section aria-labelledby="id-money">
      <CardHead title={<span id="id-money">Money</span>} level={3} className="border-t" />
      <CardBody>
        <dl className="m-0 flex flex-col gap-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="num m-0 text-end font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </section>
  );
}

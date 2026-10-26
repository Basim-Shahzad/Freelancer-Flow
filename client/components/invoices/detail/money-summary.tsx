import { CardBody, CardHead } from "@/components/ui/section";
import { formatMoney } from "@/lib/money";
import type { InvoiceDetail } from "@/lib/types";

/** Key/values in the invoice's own currency, straight from the server (nothing is recomputed or summed across currencies). */
export function MoneySummary({ invoice }: { invoice: InvoiceDetail }) {
  const c = invoice.currency;
  const rows: [string, string][] = [
    ["Subtotal", formatMoney(invoice.subtotal, c)],
    ...(invoice.discountAmount > 0 ? [["Discount", `− ${formatMoney(invoice.discountAmount, c)}`] as [string, string]] : []),
    ...invoice.taxes.filter((t) => !t.isWithholding).map((t): [string, string] => [`${t.name} (${Number(t.rate)}%)`, formatMoney(t.amount, c)]),
    ...(invoice.withholdingAmount > 0 ? [["Withholding", `− ${formatMoney(invoice.withholdingAmount, c)}`] as [string, string]] : []),
    ["Total", formatMoney(invoice.total, c)],
    ["Paid so far", formatMoney(invoice.amountPaid, c)],
    ["Balance", formatMoney(invoice.balanceDue, c)],
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

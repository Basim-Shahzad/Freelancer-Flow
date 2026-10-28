"use client";

import { Money } from "@/components/domain/money";
import { counterpartOf } from "@/lib/fx";
import type { DocInvoice } from "@/lib/invoice-doc";
import { formatAmount } from "@/lib/money";
import type { Client, Project } from "@/lib/types";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}

/** Sticky running summary: subtotal, discount, tax, total (+ labelled estimate). A preview; the server computes the real numbers on create. */
export function Summary({ invoice, client, project, defaultTaxes }: { invoice: DocInvoice; client?: Client; project?: Project; defaultTaxes?: boolean }) {
  const cur = invoice.currency;
  return (
    <aside aria-label="Invoice summary" className="@4xl:sticky @4xl:top-4">
      <div className="flex flex-col gap-4 border-y border-rule py-4">
        <span className="t-eyebrow">Invoice summary</span>
        <div>
          <div className="font-semibold leading-snug">{client?.name ?? "No client"}</div>
          <div className="text-xs text-muted-foreground">{project?.name ?? "No project"} · {invoice.lines.length} {invoice.lines.length === 1 ? "line" : "lines"}</div>
        </div>
        <div>
          <Row k="Subtotal" v={`${cur} ${formatAmount(invoice.subtotal, cur)}`} />
          <Row k="Discount" v={invoice.discount > 0 ? `− ${formatAmount(invoice.discount, cur)}` : "—"} />
          {invoice.taxes.map((t) => <Row key={t.label} k={t.label} v={formatAmount(t.amount, cur)} />)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="t-eyebrow">Total</span>
          <Money size="lg" currency={cur} amount={invoice.total} estimateIn={counterpartOf(cur)} note />
        </div>
        {defaultTaxes && <p className="t-caption">Your default taxes are added when the invoice is created, so the final total may differ.</p>}
      </div>
    </aside>
  );
}

"use client";

import { Money } from "@/components/domain/money";
import { calcTotals } from "@/lib/invoice";
import { formatAmount } from "@/lib/money";
import type { Client, Invoice, Project } from "@/lib/types";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}

/** Sticky running summary: subtotal, discount, tax, total (+ labelled estimate). */
export function Summary({ invoice, client, project }: { invoice: Invoice; client?: Client; project?: Project }) {
  const t = calcTotals(invoice);
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
          <Row k="Subtotal" v={`${cur} ${formatAmount(t.subtotal, cur)}`} />
          <Row k="Discount" v={t.discount > 0 ? `− ${formatAmount(t.discount, cur)}` : "—"} />
          <Row k={`Tax ${invoice.taxPercent}%`} v={formatAmount(t.tax, cur)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="t-eyebrow">Total</span>
          <Money size="lg" currency={cur} amount={t.total} estimateIn={cur === "PKR" ? "USD" : "PKR"} note />
        </div>
      </div>
    </aside>
  );
}

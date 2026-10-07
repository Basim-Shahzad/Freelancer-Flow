"use client";

import { InvoiceDocument } from "@/components/domain/invoice-document";
import { KV } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { fmtDate } from "@/lib/dates";
import { calcTotals } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { methodTitle } from "@/lib/payment-methods";
import type { BusinessProfile, Client, Invoice, PaymentMethod, Project } from "@/lib/types";
import { termsLabel } from "./logic";

interface Props { invoice: Invoice; client?: Client; project?: Project; business: BusinessProfile; methods: PaymentMethod[]; termsDays: number }

export function StepReview({ invoice, client, project, business, methods, termsDays }: Props) {
  return (
    <section aria-labelledby="ic-5" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2"><h2 id="ic-5" className="t-h2">Review</h2></div>
      <div>
        <KV label="Client">{client?.name ?? "—"}</KV>
        <KV label="Project">{project?.name ?? "—"}</KV>
        <KV label="Lines">{invoice.lines.length} selected</KV>
        <KV label="Total"><span className="num font-semibold">{formatMoney(calcTotals(invoice).total, invoice.currency)}</span></KV>
        <KV label="Due">{fmtDate(invoice.dueDate)} · {termsLabel(termsDays)}</KV>
        <KV label="Pay by">
          <div className="flex flex-wrap gap-1.5">
            {methods.length ? methods.map((m) => <Tag key={m.id}>{methodTitle(m)}</Tag>) : <span className="text-muted-foreground">No methods selected</span>}
          </div>
        </KV>
      </div>
      <h3 className="t-h3">What your client will see</h3>
      <InvoiceDocument invoice={invoice} client={client} business={business} methods={methods} projectName={project?.name} status="draft" />
      <p className="t-caption">This is the same layout as the PDF. Draft numbers are final once you create the invoice.</p>
    </section>
  );
}

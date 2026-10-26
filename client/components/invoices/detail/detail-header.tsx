"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { InvoiceDetail } from "@/lib/types";
import { claimTail } from "./messages";

interface Props {
  invoice: InvoiceDetail;
  onDownload: () => void;
  downloading: boolean;
  offline: boolean;
}

/** Breadcrumb, title + status chip, one data-driven sentence, and the Download PDF pill. */
export function DetailHeader({ invoice, onDownload, downloading, offline }: Props) {
  const { currency, status } = invoice;
  const paidOn = invoice.paymentAt ?? [...invoice.payments].map((p) => p.paidAt).sort().at(-1);
  const tail = claimTail(status, {
    paid: formatMoney(invoice.amountPaid, currency), balance: formatMoney(invoice.balanceDue, currency), dueDate: fmtDate(invoice.dueDate),
    overdueDays: Math.max(daysBetween(todayISO(), invoice.dueDate), 0), daysToDue: daysBetween(invoice.dueDate, todayISO()), paidDate: fmtDate(paidOn),
    daysToPay: paidOn ? daysBetween(paidOn, invoice.issueDate) : -1,
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="m-0 flex list-none items-center gap-1.5 p-0">
            <li><Link href="/invoices" className="inline-flex min-h-9 items-center text-muted-foreground no-underline hover:text-foreground">Invoices</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="num text-foreground">{invoice.number}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h1">{invoice.number}</h1>
          <StatusChip status={status} />
        </div>
        <p className="max-w-[64ch] text-sm text-muted-foreground">
          <span className="num">{formatMoney(invoice.total, currency)}</span>
          {` to ${invoice.client.name}`}
          {" for "}<Link href={`/projects/${invoice.project.id}`} className="font-medium text-primary-ink underline decoration-1 underline-offset-[3px]">{invoice.project.name}</Link>
          {`. ${tail}`}
        </p>
      </div>
      <Button variant="outline" onClick={onDownload} loading={downloading} disabled={offline} className="print:hidden"><Download aria-hidden="true" />Download PDF</Button>
    </header>
  );
}

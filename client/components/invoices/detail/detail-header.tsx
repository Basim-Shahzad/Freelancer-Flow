"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { daysOverdue } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import type { Client, Invoice, InvoiceStatus, Project } from "@/lib/types";
import { claimTail } from "./messages";

interface Props {
  invoice: Invoice;
  status: InvoiceStatus;
  total: number;
  paid: number;
  balance: number;
  client?: Client;
  project?: Project;
  onPrint: () => void;
}

/** Breadcrumb, title + status chip, one data-driven sentence, and the Print / PDF pill. */
export function DetailHeader({ invoice, status, total, paid, balance, client, project, onPrint }: Props) {
  const lastPaid = invoice.payments.map((p) => p.date).sort().at(-1);
  const tail = claimTail(status, {
    paid: formatMoney(paid, invoice.currency), balance: formatMoney(balance, invoice.currency), dueDate: fmtDate(invoice.dueDate),
    overdueDays: daysOverdue(invoice), daysToDue: daysBetween(invoice.dueDate, todayISO()), paidDate: fmtDate(lastPaid),
    daysToPay: lastPaid ? daysBetween(lastPaid, invoice.issueDate) : -1,
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
          <span className="num">{formatMoney(total, invoice.currency)}</span>
          {client ? ` to ${client.name}` : ""}
          {project && <> for <Link href={`/projects/${project.id}`} className="font-medium text-primary-ink underline decoration-1 underline-offset-[3px]">{project.name}</Link></>}
          {`. ${tail}`}
        </p>
      </div>
      <Button variant="outline" onClick={onPrint} className="print:hidden"><Printer aria-hidden="true" />Print / PDF</Button>
    </header>
  );
}

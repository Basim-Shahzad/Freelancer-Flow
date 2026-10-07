import Link from "next/link";
import { Money } from "@/components/domain/money";
import { StatusChip } from "@/components/domain/status-chip";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { methodSummaryLabel } from "./labels";
import type { AttentionItem, PaymentRow } from "./aggregate";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

const REASON_TEXT = (a: AttentionItem): string => {
  if (a.reason === "overdue") return `${a.days} ${a.days === 1 ? "day" : "days"} late`;
  if (a.reason === "draft") return "Draft, not sent yet";
  return a.days === 0 ? "Due today" : a.days === 1 ? "Due tomorrow" : `Due in ${a.days} days`;
};

/** Invoices needing attention: overdue, due within 3 days, or unsent drafts. */
export function AttentionSection({ items }: { items: AttentionItem[] }) {
  const cols = "minmax(0,1.2fr) minmax(0,1fr) auto auto";
  return (
    <Card>
      <CardHead title="Needs attention" sub="Overdue, due within three days, or drafts not sent" action={<Link href="/invoices" className={linkCls}>All invoices</Link>} />
      <CardBody className="py-1">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is overdue or due in the next three days.</p>
      ) : (
        <div>
          {items.map((a) => (
            <LedgerRow key={a.view.id} cols={cols} href={`/invoices/${a.view.id}`}>
              <LCell><LMain className="num">{a.view.number}</LMain><LSub>{a.view.client?.name ?? "—"}</LSub></LCell>
              <LCell narrow="hide"><LSub className="text-sm">{REASON_TEXT(a)}</LSub></LCell>
              <LCell narrow="hide"><StatusChip status={a.view.display} /></LCell>
              <LCell end>
                <Money amount={a.view.display === "draft" ? a.view.totals.total : a.view.totals.balance} currency={a.view.currency} size="sm" align="end" />
                <LSub className="@2xl:hidden">{REASON_TEXT(a)}</LSub>
              </LCell>
            </LedgerRow>
          ))}
        </div>
      )}
      </CardBody>
    </Card>
  );
}

/** The "cash" ledger: the most recent recorded payments. */
export function PaymentsSection({ rows }: { rows: PaymentRow[] }) {
  const cols = "5.5rem minmax(0,1fr) auto";
  return (
    <Card>
      <CardHead title="Recent payments" sub="Recorded by you, newest first" />
      <CardBody className="py-1">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet. When a client pays, record it on the invoice and it lands here.</p>
      ) : (
        <div>
          {rows.map(({ invoice, payment }) => (
            <LedgerRow key={payment.id} cols={cols} href={`/invoices/${invoice.id}`}>
              <LCell narrow="hide"><span className="num text-xs text-muted-foreground">{fmtDate(payment.date).slice(0, 6)}</span></LCell>
              <LCell>
                <LMain className="font-medium">Payment recorded · {invoice.number}</LMain>
                <LSub>{invoice.client?.name ?? "—"} · {methodSummaryLabel(payment.method, payment.reference)} · <span className="@2xl:hidden">{fmtDate(payment.date)}</span></LSub>
              </LCell>
              <LCell end><Money amount={payment.amount} currency={invoice.currency} size="sm" align="end" /></LCell>
            </LedgerRow>
          ))}
        </div>
      )}
      </CardBody>
    </Card>
  );
}

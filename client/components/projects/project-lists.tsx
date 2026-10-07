import Link from "next/link";
import { format } from "date-fns";
import { Money } from "@/components/domain/money";
import { StatusChip } from "@/components/domain/status-chip";
import { Tag } from "@/components/ui/tag";
import { Card, CardBody, CardFoot, CardHead } from "@/components/ui/section";
import { parse } from "@/lib/dates";
import { formatDuration } from "@/lib/money";
import type { InvoiceView } from "@/lib/selectors";
import type { Client, Project, TimeEntry } from "@/lib/types";
import { ClientDot } from "./client-dot";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";
const SHOWN = 12;

/** What a time entry means for the money: in the fee, on an invoice, still unbilled or not billable. */
function moneyLabel(t: TimeEntry, project: Project, views: InvoiceView[]): string {
  if (!t.billable) return "Non-billable";
  if (t.invoiceId) return `On ${views.find((v) => v.id === t.invoiceId)?.number ?? "an invoice"}`;
  return project.billingType === "hourly" ? "Unbilled" : "In the fee";
}

export function LinkedTime({ time, project, views }: { time: TimeEntry[]; project: Project; views: InvoiceView[] }) {
  const sorted = [...time].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = time.reduce((s, t) => s + t.minutes, 0);
  return (
    <Card>
      <CardHead
        title="Time entries"
        sub={time.length === 0 ? undefined : `${time.length} ${time.length === 1 ? "entry" : "entries"}, ${formatDuration(total)} in total. Latest first.`}
        action={<Link href="/time" className={linkCls}>Open in Time</Link>}
      />
      {sorted.length === 0 ? <CardBody><p className="m-0 text-sm text-muted-foreground">No time logged against this project yet.</p></CardBody> : (
        <ul className="m-0 list-none p-0">
          {sorted.slice(0, SHOWN).map((t) => (
            <li key={t.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-border px-5 py-3 text-sm last:border-b-0 @2xl:grid-cols-[5rem_minmax(0,1fr)_6rem_8rem]">
              <span className="num text-xs text-muted-foreground">{format(parse(t.date), "d MMM")}</span>
              <span className="min-w-0">{t.description}</span>
              <span className="num text-end">{formatDuration(t.minutes)}</span>
              <span className="col-start-2 col-end-4 @2xl:col-auto @2xl:justify-self-end"><span className="inline-flex rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{moneyLabel(t, project, views)}</span></span>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > SHOWN && <CardFoot><span>Showing {SHOWN} of {sorted.length}. Older entries are on the <Link href="/time" className="text-primary-ink underline underline-offset-[3px]">Time</Link> page.</span></CardFoot>}
    </Card>
  );
}

export function LinkedInvoices({ views, projectId }: { views: InvoiceView[]; projectId: string }) {
  return (
    <Card>
      <CardHead title="Invoices" action={views.length > 0 ? <Link href={`/invoices/new?projectId=${projectId}`} className={linkCls}>New invoice</Link> : undefined} />
      {views.length === 0 ? (
        <CardBody><p className="m-0 text-sm text-muted-foreground">Nothing invoiced yet. <Link href={`/invoices/new?projectId=${projectId}`} className="font-medium text-primary-ink underline underline-offset-[3px]">Create an invoice.</Link></p></CardBody>
      ) : (
        <ul className="m-0 list-none p-0">
          {views.map((v) => (
            <li key={v.id} className="border-b border-border last:border-b-0">
              <Link href={`/invoices/${v.id}`} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-3 text-inherit no-underline hover:bg-hover">
                <span><span className="num block font-semibold">{v.number}</span></span>
                <StatusChip status={v.display} />
                <Money amount={v.totals.total} currency={v.currency} size="sm" align="end" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProjectClientCard({ client, clientIds }: { client?: Client; clientIds: readonly string[] }) {
  return (
    <Card>
      <CardHead title="Client" />
      <CardBody className="flex flex-col gap-3">
        {client ? (
          <>
            <div>
              <p className="m-0 inline-flex items-center gap-2 font-semibold"><ClientDot clientId={client.id} clientIds={clientIds} />{client.name}</p>
              <p className="m-0 mt-0.5 text-sm text-muted-foreground">{[client.contactName, client.email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-1.5"><Tag>{client.currency}</Tag><Tag>{client.termsDays === 0 ? "Due on receipt" : `Net ${client.termsDays}`}</Tag></div>
            <div><Link href={`/clients/${client.id}`} className={linkCls}>Open client</Link></div>
          </>
        ) : <p className="m-0 text-sm text-muted-foreground">This project has no client.</p>}
      </CardBody>
    </Card>
  );
}

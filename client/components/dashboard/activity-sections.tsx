import Link from "next/link";
import { Money } from "@/components/domain/money";
import { StatusChip } from "@/components/domain/status-chip";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import type { ActivityEventResponse } from "@/lib/api/activity.types";
import { fmtDate } from "@/lib/dates";
import type { AttentionItem } from "./attention";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

const REASON_TEXT = (a: AttentionItem): string => {
  if (a.reason === "overdue") return `${a.days} ${a.days === 1 ? "day" : "days"} late`;
  if (a.reason === "draft") return "Draft, not sent yet";
  return a.days === 0 ? "Due today" : a.days === 1 ? "Due tomorrow" : `Due in ${a.days} days`;
};

/** Invoices needing attention: overdue, due within 3 days, or unsent drafts. */
export function AttentionSection({ items, isPending = false, isError = false, onRetry }: { items: AttentionItem[]; isPending?: boolean; isError?: boolean; onRetry?: () => void }) {
  const cols = "minmax(0,1.2fr) minmax(0,1fr) auto auto";
  return (
    <Card>
      <CardHead title="Needs attention" sub="Overdue, due within three days, or drafts not sent" action={<Link href="/invoices" className={linkCls}>All invoices</Link>} />
      <CardBody className="py-1">
      {isPending && items.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">Loading invoices…</p>
      ) : isError && items.length === 0 ? (
        <p role="alert" className="text-sm text-muted-foreground">Couldn’t load invoices. {onRetry && <button type="button" onClick={onRetry} className="font-medium text-primary-ink underline underline-offset-[3px]">Try again</button>}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is overdue or due in the next three days.</p>
      ) : (
        <div>
          {items.map((a) => (
            <LedgerRow key={a.view.id} cols={cols} href={`/invoices/${a.view.id}`}>
              <LCell><LMain className="num">{a.view.number}</LMain><LSub>{a.view.client.name}</LSub></LCell>
              <LCell narrow="hide"><LSub className="text-sm">{REASON_TEXT(a)}</LSub></LCell>
              <LCell narrow="hide"><StatusChip status={a.view.status} /></LCell>
              <LCell end>
                <Money amount={a.view.status === "draft" ? a.view.total : a.view.balanceDue} currency={a.view.currency} size="sm" align="end" />
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

const ENTITY_HREF: Record<string, string> = { invoice: "/invoices", project: "/projects", client: "/clients" };

const hrefFor = (e: ActivityEventResponse) => {
  const base = ENTITY_HREF[e.entityType];
  return base ? `${base}/${e.entityId}` : e.entityType === "time_entry" ? "/time" : "/settings/activity";
};

/** The most recent audit events, linked to the thing they happened to. */
export function ActivitySection({ events, isPending = false, isError = false, onRetry }: { events: ActivityEventResponse[]; isPending?: boolean; isError?: boolean; onRetry?: () => void }) {
  const cols = "5.5rem minmax(0,1fr)";
  return (
    <Card>
      <CardHead title="Recent activity" sub="Newest first" action={<Link href="/settings/activity" className={linkCls}>All activity</Link>} />
      <CardBody className="py-1">
      {isPending && events.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">Loading activity…</p>
      ) : isError && events.length === 0 ? (
        <p role="alert" className="text-sm text-muted-foreground">Couldn’t load activity. {onRetry && <button type="button" onClick={onRetry} className="font-medium text-primary-ink underline underline-offset-[3px]">Try again</button>}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has happened yet. Invoices, payments and time you record show up here.</p>
      ) : (
        <div>
          {events.map((e) => (
            <LedgerRow key={e.id} cols={cols} href={hrefFor(e)}>
              <LCell narrow="hide"><span className="num text-xs text-muted-foreground">{fmtDate(e.createdAt.slice(0, 10)).slice(0, 6)}</span></LCell>
              <LCell><LMain className="font-medium">{e.summary}</LMain><LSub className="@2xl:hidden">{fmtDate(e.createdAt.slice(0, 10))}</LSub></LCell>
            </LedgerRow>
          ))}
        </div>
      )}
      </CardBody>
    </Card>
  );
}

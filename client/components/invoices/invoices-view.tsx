"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { Money } from "@/components/domain/money";
import { StateBlock } from "@/components/domain/state-block";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { SelectField } from "@/components/ui/select";
import { Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { useClientOptions } from "@/lib/hooks/clients";
import { useInvoices, type InvoiceStatusFilter } from "@/lib/hooks/invoices";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { AMOUNT_TAGS, countLine, STATUS_FILTERS } from "./list-logic";

const COLS = "7rem minmax(0,2fr) 8rem 9rem 11rem";
const ALL = "";

const createBtn = <Button asChild><Link href="/invoices/new"><Plus aria-hidden="true" />Create invoice</Link></Button>;

export function InvoicesView() {
  const online = useAppStore((s) => s.online);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState(ALL);
  const [status, setStatus] = useState<InvoiceStatusFilter>("all");
  const search = useDebouncedValue(q.trim(), 300);
  const query = useInvoices({ search, clientId: clientId || undefined, status });
  // Same query as the sidebar badge, so the overdue count is shared and cached.
  const overdue = useInvoices({ status: "overdue", limit: 1 }).data?.total ?? 0;
  const { clients } = useClientOptions();
  const { data } = query;

  if (query.isPending) {
    if (!online) return <Shell><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Shell>;
    return <Shell><div role="status" aria-label="Loading invoices" className="flex flex-col gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div></Shell>;
  }
  if (query.isError && !data) {
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (!online) return <Shell><StateBlock kind="offline" cta={retry} /></Shell>;
    if (getApiErrorStatus(query.error) === 429) return <Shell><StateBlock kind="error" title="Too many requests" body="You’re going a little fast. Wait a moment and try again." cta={retry} /></Shell>;
    return <Shell><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Shell>;
  }

  const invoices = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const filtering = search !== "" || q.trim() !== "" || clientId !== ALL || status !== "all";

  if (total === 0 && !filtering) {
    return (
      <Shell>
        <StateBlock kind="empty" title="No invoices yet" body="Pick a project, tick the work that’s ready, and send a clear invoice in under five minutes." cta={{ label: "Create your first invoice", href: "/invoices/new" }} />
      </Shell>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={countLine(total, overdue)} title="Invoices" actions={createBtn} />
      <OfflineNotice detail="Sending, reminders and recording payments need a connection and are paused." />

      <Toolbar>
        <InputAffix prefix={<Search className="size-4" aria-hidden="true" />} className="min-w-56 flex-1 @2xl:max-w-80">
          <Label className="sr-only" htmlFor="iv-q">Search invoices</Label>
          <Input id="iv-q" type="search" placeholder="Invoice number" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputAffix>
        <Label className="sr-only" htmlFor="iv-c">Client</Label>
        <SelectField
          id="iv-c" className="w-auto min-w-40" value={clientId} onValueChange={setClientId}
          options={[{ value: ALL, label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.companyName || c.name }))]}
        />
        <Label className="sr-only" htmlFor="iv-s">Status</Label>
        <SelectField id="iv-s" className="w-auto min-w-40" value={status} onValueChange={(v) => setStatus(v as InvoiceStatusFilter)} options={STATUS_FILTERS} />
      </Toolbar>

      <section aria-label="Invoice list" aria-busy={query.isFetching}>
        <LedgerHead cols={COLS}>
          <span>Number</span><span>Client</span><span>Due</span><span>Status</span><span className="justify-self-end">Amount</span>
        </LedgerHead>
        {invoices.map((v) => (
          <LedgerRow key={v.id} cols={COLS} href={`/invoices/${v.id}`}>
            <LCell><LMain className="num">{v.number}<span className="sr-only">, open invoice</span></LMain></LCell>
            <LCell narrow="full" className="order-2 @2xl:order-none"><LMain>{v.client.name}</LMain><LSub>{v.project.name}</LSub></LCell>
            <LCell narrow="hide" className="text-sm text-muted-foreground">{v.status === "draft" ? "—" : fmtDate(v.dueDate)}</LCell>
            <LCell className="order-3 @2xl:order-none"><StatusChip status={v.status} /></LCell>
            <LCell end className="order-1 @2xl:order-none">
              <Money size="sm" align="end" currency={v.currency} amount={v.status === "partial" ? v.balanceDue : v.total} tag={AMOUNT_TAGS[v.status]} />
            </LCell>
          </LedgerRow>
        ))}
        {invoices.length === 0 && <p className="py-6 text-sm text-muted-foreground" role="status">{q.trim() ? `No invoices match “${q.trim()}”.` : "No invoices match these filters."}</p>}
      </section>
      {query.hasNextPage && (
        <div className="flex items-center gap-3">
          <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>
          <span className="text-sm text-muted-foreground">Showing {invoices.length} of {total}</span>
        </div>
      )}
      {query.isFetchNextPageError && <p role="alert" className="text-sm text-error-ink">{getApiErrorMessage(query.error, "Couldn’t load more invoices.")}</p>}
      <p className="t-caption">Amounts are shown in each invoice’s own currency. Paylancr does not process payments; statuses reflect payments you record.</p>
    </Page>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader eyebrow="Invoices" title="Invoices" actions={createBtn} />
      {children}
    </Page>
  );
}

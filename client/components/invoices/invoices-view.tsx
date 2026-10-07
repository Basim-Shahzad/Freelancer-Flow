"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Money } from "@/components/domain/money";
import { StateBlock } from "@/components/domain/state-block";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { toInvoiceView, type InvoiceView } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import { byNumberDesc, countLine, filterInvoices, type StatusFilter } from "./list-logic";
import { Label } from "@/components/ui/label";

const COLS = "7rem minmax(0,2fr) 8rem 9rem 11rem";
const TAGS: Partial<Record<InvoiceView["display"], string>> = { partial: "balance", written_off: "written off", void: "void" };

export function InvoicesView() {
  const hydrated = useHydrated();
  if (!hydrated) return <PageSkeleton rows={6} />;
  return <InvoicesScreen />;
}

function InvoicesScreen() {
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const online = useAppStore((s) => s.online);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const views = useMemo(() => invoices.map((i) => toInvoiceView(i, clients, projects)).sort(byNumberDesc), [invoices, clients, projects]);
  const rows = useMemo(() => filterInvoices(views, { q, clientId, status }), [views, q, clientId, status]);

  return (
    <Page>
      <PageHeader
        eyebrow={views.length ? countLine(views) : "Invoices"}
        title="Invoices"
        actions={<Button asChild><Link href="/invoices/new"><Plus aria-hidden="true" />Create invoice</Link></Button>}
      />

      {!online && (
        <Notice tone="warn" role="status"><b>Showing the last synced list.</b> Sending, reminders and recording payments need a connection and are paused.</Notice>
      )}

      {views.length === 0 ? (
        <StateBlock kind="empty" title="No invoices yet" body="Pick a project, tick the work that’s ready, and send a clear invoice in under five minutes." cta={{ label: "Create your first invoice", href: "/invoices/new" }} />
      ) : (
        <>
          <Toolbar>
            <InputAffix prefix={<Search className="size-4" aria-hidden="true" />} className="min-w-56 flex-1 @2xl:max-w-80">
              <Label className="sr-only" htmlFor="iv-q">Search invoices</Label>
              <Input id="iv-q" type="search" placeholder="Number, client or project" value={q} onChange={(e) => setQ(e.target.value)} />
            </InputAffix>
            <Label className="sr-only" htmlFor="iv-c">Client</Label>
            <SelectField
              id="iv-c" className="w-auto min-w-40" value={clientId} onValueChange={setClientId}
              options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Segmented<StatusFilter> label="Status" value={status} onChange={setStatus} options={[
              { value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "unpaid", label: "Unpaid" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" },
            ]} />
          </Toolbar>

          <section aria-label="Invoice list">
            <LedgerHead cols={COLS}>
              <span>Number</span><span>Client</span><span>Due</span><span>Status</span><span className="justify-self-end">Amount</span>
            </LedgerHead>
            {rows.map((v) => {
              const showBalance = v.display === "partial";
              return (
                <LedgerRow key={v.id} cols={COLS} href={`/invoices/${v.id}`}>
                  <LCell><LMain className="num">{v.number}<span className="sr-only">, open invoice</span></LMain></LCell>
                  <LCell narrow="full" className="order-2 @2xl:order-none"><LMain>{v.client?.name ?? "—"}</LMain><LSub>{v.project?.name ?? "No project"}</LSub></LCell>
                  <LCell narrow="hide" className="text-sm text-muted-foreground">{v.display === "draft" ? "—" : fmtDate(v.dueDate)}</LCell>
                  <LCell className="order-3 @2xl:order-none"><StatusChip status={v.display} /></LCell>
                  <LCell end className="order-1 @2xl:order-none">
                    <Money size="sm" align="end" currency={v.currency} amount={showBalance ? v.totals.balance : v.totals.total} tag={TAGS[v.display]} />
                  </LCell>
                </LedgerRow>
              );
            })}
            {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">No invoices match these filters.</p>}
          </section>
          <p className="t-caption">Amounts are shown in each invoice’s own currency. Paylancr does not process payments; statuses reflect payments you record.</p>
        </>
      )}
    </Page>
  );
}

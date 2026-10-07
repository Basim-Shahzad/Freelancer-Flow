"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { currencyEntries } from "@/components/dashboard/aggregate";
import { Money } from "@/components/domain/money";
import { StateBlock } from "@/components/domain/state-block";
import { StatusChip } from "@/components/domain/status-chip";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardHead, KpiStrip, Page, PageHeader, Toolbar } from "@/components/ui/section";
import { KpiMoney } from "@/components/projects/kpi-money";
import { unbilledOf } from "@/components/projects/logic";
import { rateRow, type ByCurrency } from "@/components/projects/rate";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { todayISO } from "@/lib/dates";
import { useShallow } from "zustand/react/shallow";
import { ClientDot } from "@/components/projects/client-dot";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { toInvoiceView } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import { addToBy } from "@/components/dashboard/aggregate";
import { avgDaysToPay, clientAccount, clientWorth, daysText, matchesClient, matchesFilter, overdueClientCount, sortClientRows, type ClientFilter, type ClientRow, type ClientSort } from "./logic";
import { Label } from "@/components/ui/label";

const COLS = "minmax(0,1.5fr) minmax(0,.9fr) 4.5rem minmax(0,1fr) minmax(0,1.1fr) 1.25rem";
const SORTS: { value: ClientSort; label: string }[] = [
  { value: "worth", label: "Worth per hour" },
  { value: "fastest", label: "Pays fastest" },
  { value: "lifetime", label: "Lifetime" },
];

const FILTERS: { value: ClientFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owes", label: "Owes you" },
  { value: "overdue", label: "Overdue" },
];

export function ClientsView() {
  const hydrated = useHydrated();
  const clientIds = useAppStore(useShallow((s) => s.clients.map((c) => c.id)));
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const invoices = useAppStore((s) => s.invoices);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [sort, setSort] = useState<ClientSort>("worth");
  const time = useAppStore((s) => s.time);
  const hourlyRate = useAppStore((s) => s.business.hourlyRate);
  const base = useAppStore((s) => s.business.defaultCurrency);

  const { rows, avgDays } = useMemo(() => {
    const today = todayISO();
    const views = invoices.map((i) => toInvoiceView(i, clients, projects));
    const own = { hourlyRate, defaultCurrency: base };
    const rateRows = projects.map((p) => rateRow(p, { time, views, today, own, unbilledHourly: unbilledOf(p, time, today).amount }));
    const list: ClientRow[] = clients.map((client) => {
      const acc = clientAccount(client.id, views);
      return { client, acc, worth: clientWorth(rateRows.filter((r) => r.project.clientId === client.id), client.currency), days: avgDaysToPay(views, client.id), lifetime: acc.billed };
    });
    return { rows: list, avgDays: avgDaysToPay(views) };
  }, [clients, projects, invoices, time, hourlyRate, base]);

  if (!hydrated) return <PageSkeleton />;

  const shown = sortClientRows(rows.filter((r) => matchesClient(r.client, q) && matchesFilter(r.acc, filter)), sort, base);
  const owed: ByCurrency = {};
  for (const r of rows) for (const [c, a] of currencyEntries(r.acc.outstanding)) addToBy(owed, c, a);
  const overdueN = overdueClientCount(rows);
  const kpis = [
    { value: String(clients.length), label: clients.length === 1 ? "Client" : "Clients" },
    { value: <KpiMoney by={owed} base={base} />, label: "Open owed" },
    ...(avgDays !== null ? [{ value: daysText(avgDays), label: "Average days to pay" }] : []),
    { value: String(overdueN), label: "Clients with overdue", tone: overdueN > 0 ? ("bad" as const) : undefined },
  ];
  const addBtn = <Button asChild><Link href="/clients/new"><Plus aria-hidden="true" />Add client</Link></Button>;

  if (clients.length === 0) {
    return (
      <Page>
        <PageHeader eyebrow="Clients" title="Clients" actions={addBtn} />
        <StateBlock kind="empty" title="No clients yet" body="Add the first person or company you work for. Include a WhatsApp number to share invoices and reminders in one tap." cta={{ label: "Add client", href: "/clients/new" }} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={`${clients.length} ${clients.length === 1 ? "client" : "clients"}`} title="Clients" actions={addBtn} />
      <OfflineNotice />
      <KpiStrip items={kpis} />
      <Toolbar>
        <InputAffix className="min-w-0 flex-1 basis-64 @2xl:max-w-sm" prefix={<Search className="size-4" aria-hidden="true" />}>
          <Label className="sr-only" htmlFor="cl-q">Search clients</Label>
          <Input id="cl-q" type="search" placeholder="Search by name or city" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputAffix>
        <Segmented label="Filter clients" value={filter} onChange={setFilter} options={FILTERS} />
      </Toolbar>

      <Card>
        <CardHead
          title="Your clients"
          sub="Worth per hour is fee ÷ billable hours on fee-based projects, and your contract rate on hourly ones, within one currency."
          action={<Segmented label="Sort clients" value={sort} onChange={setSort} options={SORTS} />}
        />
        <section aria-label="Client list" className="px-5">
          <LedgerHead cols={COLS}>
            <span>Client</span><span>Location</span><span>Bills in</span><span>Worth per hour</span><span className="text-end">Outstanding</span><span />
          </LedgerHead>
          {shown.map(({ client, acc, worth, days }) => {
            const owedBy = currencyEntries(acc.outstanding);
            return (
              <LedgerRow key={client.id} cols={COLS} href={`/clients/${client.id}`} className="last:border-b-0">
                <LCell>
                  <LMain className="inline-flex items-center gap-2"><ClientDot clientId={client.id} clientIds={clientIds} />{client.name}</LMain>
                  <LSub>{client.contactName || client.email}</LSub>
                </LCell>
                <LCell narrow="hide"><span className="text-sm text-muted-foreground">{[client.city, client.country].filter(Boolean).join(", ") || "—"}</span></LCell>
                <LCell narrow="hide"><Tag>{client.currency}</Tag></LCell>
                <LCell narrow="hide">
                  {worth ? <Money amount={worth.amount} currency={worth.currency} size="sm" /> : <LSub>No hours yet</LSub>}
                  <LSub className="mt-0.5">{days !== null ? `Pays in ${daysText(days)}` : "No paid invoices yet"}</LSub>
                </LCell>
                <LCell end className="flex flex-col items-end gap-1.5">
                  {owedBy.length === 0 ? <LSub>Nothing owed</LSub> : owedBy.map(([cur, amt]) => <Money key={cur} amount={amt} currency={cur} size="sm" align="end" />)}
                  {acc.isOverdue && <StatusChip status="overdue" />}
                </LCell>
                <LCell narrow="hide"><ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /></LCell>
              </LedgerRow>
            );
          })}
          {shown.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground" role="status">
              {q.trim() ? <>No clients match “{q.trim()}”{filter !== "all" ? " with this filter" : ""}.</> : filter === "overdue" ? "No client has an overdue invoice." : "No client owes you right now."}
            </p>
          )}
        </section>
      </Card>
    </Page>
  );
}

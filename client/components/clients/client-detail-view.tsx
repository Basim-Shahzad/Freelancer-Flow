"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { CurrencyStack } from "@/components/dashboard/currency-stack";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { Money } from "@/components/domain/money";
import { StateBlock } from "@/components/domain/state-block";
import { StatusChip } from "@/components/domain/status-chip";
import { ClientDot } from "@/components/projects/client-dot";
import { KpiMoney } from "@/components/projects/kpi-money";
import { rateLabel, unbilledOf } from "@/components/projects/logic";
import { ProjectStatusChip } from "@/components/projects/project-status-chip";
import { hoursText, rateRow } from "@/components/projects/rate";
import { Button } from "@/components/ui/button";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Card, CardBody, CardHead, KpiStrip, Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDate, todayISO } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatMoney } from "@/lib/money";
import { byDateDesc, toInvoiceView } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import { ClientDetails } from "./client-details";
import { DeleteClientDialog } from "./delete-client-dialog";
import { avgDaysToPay, clientAccount, clientWorth, daysText } from "./logic";
import { termsLabel } from "./schema";

const linkCls = "inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]";

export function ClientDetailView({ id }: { id: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore(useShallow((s) => s.projects.filter((p) => p.clientId === id)));
  const allProjects = useAppStore((s) => s.projects);
  const invoices = useAppStore((s) => s.invoices);
  const time = useAppStore((s) => s.time);
  const hourlyRate = useAppStore((s) => s.business.hourlyRate);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const base = useAppStore((s) => s.business.defaultCurrency);
  const [gone, setGone] = useState(false);

  const views = useMemo(
    () => invoices.filter((i) => i.clientId === id).map((i) => toInvoiceView(i, clients, allProjects)).sort(byDateDesc),
    [invoices, clients, allProjects, id],
  );
  const acc = useMemo(() => clientAccount(id, views), [id, views]);
  const avgDays = useMemo(() => avgDaysToPay(views), [views]);
  const rows = useMemo(() => {
    const today = todayISO();
    const own = { hourlyRate, defaultCurrency: base };
    return projects.map((p) => rateRow(p, { time, views, today, own, unbilledHourly: unbilledOf(p, time, today).amount }));
  }, [projects, time, views, hourlyRate, base]);
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);

  if (!hydrated || gone) return <PageSkeleton rows={3} />;
  if (!client) {
    return (
      <Page>
        <StateBlock kind="empty" title="Client not found" body="This client may have been deleted, or the link is wrong." cta={{ label: "Back to clients", href: "/clients" }} />
      </Page>
    );
  }

  const worth = clientWorth(rows, client.currency);
  const sentence = [
    avgDays !== null ? `Pays in ${daysText(avgDays)} on average against ${termsLabel(client.termsDays).toLowerCase()} terms.` : "No paid invoices yet, so no pay speed to show.",
    worth ? `An hour with them is worth about ${formatMoney(worth.amount, worth.currency)}.` : "",
  ].filter(Boolean).join(" ");
  const onDelete = () => {
    setGone(true);
    router.push("/clients");
    deleteClient(client.id);
    toast.success(`${client.name} deleted`);
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        eyebrow={`Client${client.city ? ` · ${client.city}${client.country ? `, ${client.country}` : ""}` : ""}`}
        title={<span className="inline-flex items-center gap-3"><ClientDot clientId={client.id} clientIds={clientIds} className="size-3" />{client.name}</span>}
        meta={sentence}
        actions={
          <>
            <Button variant="outline" asChild><Link href={`/clients/${client.id}/edit`}>Edit</Link></Button>
            <Button variant="outline" asChild><Link href={`/projects/new?clientId=${client.id}`}>New project</Link></Button>
            <Button asChild><Link href={`/invoices/new?clientId=${client.id}`}>Create invoice</Link></Button>
          </>
        }
      />
      <OfflineNotice />
      <KpiStrip items={[
        { value: <KpiMoney by={acc.paid} base={base} fallback={client.currency} />, label: "Paid to date" },
        { value: <KpiMoney by={acc.outstanding} base={base} fallback={client.currency} />, label: "Open now" },
        { value: avgDays !== null ? daysText(avgDays) : "—", label: avgDays !== null ? "Average days to pay" : "Average days to pay, once an invoice is paid" },
        { value: String(projects.length), label: projects.length === 1 ? "Project" : "Projects" },
      ]} />
      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHead title="Projects" action={<Link href={`/projects/new?clientId=${client.id}`} className={linkCls}>New project</Link>} />
            {rows.length === 0 ? (
              <CardBody><p className="m-0 text-sm text-muted-foreground">No projects for {client.name} yet.</p></CardBody>
            ) : (
              <div className="px-5">
                {rows.map((r) => {
                  const cols = "minmax(0,1.6fr) auto 4.5rem 6.5rem";
                  return (
                    <LedgerRow key={r.project.id} cols={cols} href={`/projects/${r.project.id}`} className="last:border-b-0">
                      <LCell><LMain>{r.project.name}</LMain><LSub>{rateLabel(r.project)}</LSub></LCell>
                      <LCell end><ProjectStatusChip status={r.project.status} /></LCell>
                      <LCell narrow="hide" end><span className="num text-sm">{hoursText(r.minutes)}</span></LCell>
                      <LCell narrow="hide" end>{r.rate !== null ? <span className={r.verdict === "below" ? "num text-sm font-medium text-error-ink" : "num text-sm"}>{formatMoney(r.rate, r.project.currency)}/h</span> : <LSub>No rate yet</LSub>}</LCell>
                    </LedgerRow>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Invoices" action={<Link href="/invoices" className={linkCls}>All invoices</Link>} />
            {views.length === 0 ? (
              <CardBody><p className="m-0 text-sm text-muted-foreground">No invoices yet. <Link href={`/invoices/new?clientId=${client.id}`} className="font-medium text-primary-ink underline underline-offset-[3px]">Create the first one.</Link></p></CardBody>
            ) : (
              <div className="px-5">
                {views.map((v) => {
                  const cols = "6rem minmax(0,1fr) 7rem auto auto";
                  return (
                    <LedgerRow key={v.id} cols={cols} href={`/invoices/${v.id}`} className="last:border-b-0">
                      <LCell><LMain className="num">{v.number}</LMain></LCell>
                      <LCell narrow="hide"><LSub className="text-sm">{v.project?.name ?? "No project"}</LSub></LCell>
                      <LCell narrow="hide"><span className="num text-sm">{fmtDate(v.dueDate)}</span></LCell>
                      <LCell narrow="hide"><StatusChip status={v.display} /></LCell>
                      <LCell end><Money amount={v.totals.total} currency={v.currency} size="sm" align="end" /><span className="mt-1 inline-block @2xl:hidden"><StatusChip status={v.display} /></span></LCell>
                    </LedgerRow>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Account by currency" sub="Each currency is kept on its own. Converted figures are estimates only." />
            <CardBody className="grid gap-6 @2xl:grid-cols-3">
              <div className="flex flex-col gap-2"><span className="t-eyebrow">Billed</span><CurrencyStack by={acc.billed} fallback={client.currency} /></div>
              <div className="flex flex-col gap-2"><span className="t-eyebrow">Paid</span><CurrencyStack by={acc.paid} fallback={client.currency} /></div>
              <div className="flex flex-col gap-2"><span className="t-eyebrow">Outstanding</span><CurrencyStack by={acc.outstanding} fallback={client.currency} estimateBase={base} note /></div>
            </CardBody>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6" aria-label="Client details">
          <ClientDetails client={client} />
          <div className="flex flex-col gap-2 border-t border-rule pt-4">
            <DeleteClientDialog name={client.name} projects={projects.length} invoices={views.length} onConfirm={onDelete} />
          </div>
        </aside>
      </div>
    </Page>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { StateBlock } from "@/components/domain/state-block";
import { deriveStage, projectProgress } from "@/components/projects/logic";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { byDateDesc, toInvoiceView } from "@/lib/selectors";
import { AttentionSection, PaymentsSection } from "./activity-sections";
import { attentionInvoices, cashIn, monthRange, recentPayments, unbilledSummary } from "./aggregate";
import { CashSection } from "./money-sections";
import { OfflineNotice } from "./offline-notice";
import { ProjectsSection, type ActiveProjectRow } from "./projects-section";
import { OwedHero } from "./owed-hero";
import { activeCurrencies, sentToPaidDays, stagesByCurrency } from "./stages";
import { TodayCard } from "./timer-card";

export const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

export function DashboardView() {
  const hydrated = useHydrated();
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const invoices = useAppStore((s) => s.invoices);
  const time = useAppStore((s) => s.time);
  const base = useAppStore((s) => s.business.defaultCurrency);
  const userName = useAuthStore((s) => s.user?.fullName ?? undefined);

  const data = useMemo(() => {
    const today = todayISO();
    const views = invoices.map((i) => toInvoiceView(i, clients, projects)).sort(byDateDesc);
    const stages = stagesByCurrency(views, projects, time, today);
    const rows: ActiveProjectRow[] = projects
      .filter((p) => p.status === "active")
      .map((p) => ({
        project: p,
        clientName: clients.find((c) => c.id === p.clientId)?.name ?? "—",
        stage: deriveStage(p, views.filter((v) => v.projectId === p.id), time, today),
        progress: projectProgress(p, today),
      }));
    return {
      today,
      thisMonth: cashIn(views, monthRange(today)),
      lastMonth: cashIn(views, monthRange(today, -1)),
      stages, currencies: activeCurrencies(stages, base), paidDays: sentToPaidDays(views),
      unbilled: unbilledSummary(projects, time, today),
      payments: recentPayments(views, 6),
      attention: attentionInvoices(views, today, 5),
      rows,
    };
  }, [clients, projects, invoices, time, base]);

  if (!hydrated) return <PageSkeleton rows={4} />;

  const now = new Date();
  const first = userName?.split(" ")[0];
  const header = (
    <PageHeader
      eyebrow={format(now, "EEEE d MMMM yyyy")}
      title={first ? `${greeting(now.getHours())}, ${first}` : greeting(now.getHours())}
      actions={
        <>
          <Button variant="outline" asChild><Link href="/time">Add time</Link></Button>
          <Button asChild><Link href="/invoices/new"><Plus aria-hidden="true" />Create invoice</Link></Button>
        </>
      }
    />
  );

  if (clients.length === 0) {
    return (
      <Page>
        {header}
        <StateBlock kind="empty" title="Your ledger starts here" body="Add a client, then a project. Cash in, outstanding and overdue appear here once you record your first payment." cta={{ label: "Add your first client", href: "/clients/new" }} />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <OfflineNotice />
      <OwedHero stages={data.stages} currencies={data.currencies} base={base} paidDays={data.paidDays} />
      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <AttentionSection items={data.attention} />
          <CashSection thisMonth={data.thisMonth} lastMonth={data.lastMonth} today={data.today} base={base} />
          <PaymentsSection rows={data.payments} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <TodayCard today={data.today} unbilledMinutes={data.unbilled.minutes} />
          <ProjectsSection rows={data.rows} />
        </div>
      </div>
    </Page>
  );
}

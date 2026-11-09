"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { StateBlock } from "@/components/domain/state-block";
import type { StageInfo } from "@/components/projects/logic";
import { projectProgress } from "@/components/projects/logic";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/dates";
import { useDashboard } from "@/lib/hooks/dashboard";
import { useProjectOptions } from "@/lib/hooks/projects";
import { useBusiness } from "@/lib/hooks/profile";
import { getApiErrorMessage } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { ActivitySection, AttentionSection } from "./activity-sections";
import { attentionInvoices } from "./attention";
import { CashSection, UnbilledSection } from "./money-sections";
import { OfflineNotice } from "./offline-notice";
import { OwedHero } from "./owed-hero";
import { PendingScopeChanges } from "./pending-scope-changes";
import { ProjectsSection, type ActiveProjectRow } from "./projects-section";
import { TodayCard } from "./timer-card";

export const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

const ACTIVE_ROWS = 6;

export function DashboardView() {
  const { projects } = useProjectOptions();
  const dash = useDashboard();
  const online = useAppStore((s) => s.online);
  const base = useBusiness().defaultCurrency;
  const userName = useAuthStore((s) => s.user?.fullName ?? undefined);
  const today = todayISO();
  const summary = dash.summary;

  const rows = useMemo<ActiveProjectRow[]>(() => {
    const ready = new Set([...(summary?.unbilled.time ?? []), ...(summary?.unbilled.milestones ?? []), ...(summary?.unbilled.retainerPeriods ?? [])].map((u) => u.projectId));
    return projects
      .filter((p) => p.status === "active")
      .slice(0, ACTIVE_ROWS)
      .map((p) => {
        const stage: StageInfo = ready.has(p.id) ? { stage: "invoice", caption: "Something is ready to invoice." } : { stage: "work", caption: "Work is in progress. Nothing to invoice yet." };
        return { project: p, clientName: p.client.name, stage, progress: projectProgress(p) };
      });
  }, [projects, summary]);
  const attention = useMemo(() => attentionInvoices(dash.attention.invoices, today, 5), [dash.attention.invoices, today]);

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

  if (dash.isPending) return <PageSkeleton rows={4} />;

  if (dash.isError || !summary) {
    return (
      <Page>
        {header}
        <OfflineNotice />
        <StateBlock kind="error" title="Couldn’t load your dashboard" body={online ? getApiErrorMessage(dash.error) : "You’re offline. Reconnect and try again."} cta={{ label: "Try again", onClick: () => void dash.refetch() }} />
      </Page>
    );
  }

  if (summary.isEmpty && projects.length === 0) {
    return (
      <Page>
        {header}
        <OfflineNotice />
        <StateBlock kind="empty" title="Your ledger starts here" body="Add a client, then a project. Cash in, outstanding and overdue appear here once you record your first payment." cta={{ label: "Add your first client", href: "/clients/new" }} />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <OfflineNotice />
      <OwedHero summary={summary} base={base} />
      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <AttentionSection items={attention} isPending={dash.attention.isPending} isError={dash.attention.isError} onRetry={() => void dash.attention.refetch()} />
          <PendingScopeChanges />
          <CashSection cashIn={summary.cashIn} base={base} />
          <UnbilledSection unbilled={summary.unbilled} />
          <ActivitySection events={dash.activity.data?.events ?? []} isPending={dash.activity.isPending} isError={dash.activity.isError} onRetry={() => void dash.activity.refetch()} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <TodayCard today={today} unbilledMinutes={summary.unbilled.minutes} summaryTimer={summary.runningTimer} />
          <ProjectsSection rows={rows} total={summary.activeProjects} />
        </div>
      </div>
    </Page>
  );
}

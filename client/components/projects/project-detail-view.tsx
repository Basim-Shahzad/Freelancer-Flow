"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHead, KpiStrip, Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDate, todayISO } from "@/lib/dates";
import { useClient, useClientOptions } from "@/lib/hooks/clients";
import { useMilestones } from "@/lib/hooks/milestones";
import { useDeleteProject, useProject, useRetainerPeriods } from "@/lib/hooks/projects";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatDuration, formatMoney } from "@/lib/money";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Milestone, Project } from "@/lib/types";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { BILLING_LABEL, INTERVAL_LABEL, milestoneTotal, progressText, projectProgress } from "./logic";
import { MilestonesPanel } from "./milestones-panel";
import { ProjectClientCard } from "./project-lists";
import { ProjectStatusChip } from "./project-status-chip";
import { RetainerSchedule } from "./project-schedule";
import { relativeDays } from "./rate";

/** Headline numbers for one project. Money stays in the project's own currency. */
function detailKpis(p: Project, milestones: Milestone[] | undefined, today: string) {
  const cur = (n: number) => formatMoney(n, p.currency);
  const fee = p.billingType === "hourly" ? { value: p.hourlyRate !== undefined ? `${cur(p.hourlyRate)} / h` : "Profile rate", label: "Hourly rate" }
    : p.billingType === "retainer" ? { value: p.retainerAmount !== undefined ? cur(p.retainerAmount) : "—", label: `Per ${p.retainerInterval ? INTERVAL_LABEL[p.retainerInterval] : "period"}` }
      : p.billingType === "milestone" ? { value: milestones && milestoneTotal(milestones) > 0 ? cur(milestoneTotal(milestones)) : "—", label: "Milestones total" }
        : { value: p.budget !== undefined ? cur(p.budget) : "—", label: "Fixed price" };
  const progress = projectProgress(p);
  const due = p.dueDate ? { value: fmtDate(p.dueDate), label: `Due ${relativeDays(p.dueDate, today)}` } : { value: "—", label: "No due date" };
  return [
    fee,
    { value: p.totalTimeSpentMinutes > 0 ? formatDuration(p.totalTimeSpentMinutes) : "—", label: "Time tracked" },
    { value: progressText(p), label: progress ? `Complete, ${progress.basis}` : "Progress appears once there is something to measure" },
    due,
  ];
}

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const query = useProject(id);
  const project = query.data;
  const remove = useDeleteProject();
  const clientQuery = useClient(project?.clientId);
  const { clients } = useClientOptions();
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);
  const milestonesQuery = useMilestones(id, project?.currency ?? "USD", !!project?.milestonesEnabled);
  const periodsQuery = useRetainerPeriods(project);

  if (query.isPending) {
    if (!online) return <Page><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Page>;
    return <PageSkeleton rows={3} />;
  }
  if (query.isError || !project) {
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (getApiErrorStatus(query.error) === 404) {
      return <Page><StateBlock kind="empty" title="Project not found" body="This project may have been deleted, or the link is wrong." cta={{ label: "Back to projects", href: "/projects" }} /></Page>;
    }
    if (!online) return <Page><StateBlock kind="offline" cta={retry} /></Page>;
    if (getApiErrorStatus(query.error) === 429) return <Page><StateBlock kind="error" title="Too many requests" body="Wait a moment and try again." cta={retry} /></Page>;
    return <Page><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Page>;
  }

  const today = todayISO();
  const type = project.billingType;
  const onDelete = async () => {
    await remove.mutateAsync(project.id);
    toast.success(`${project.name} deleted`);
    router.push("/projects");
  };

  return (
    <Page>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        eyebrow={`${project.client.name} · ${BILLING_LABEL[type]}`}
        title={project.name}
        meta={<ProjectStatusChip status={project.status} />}
        actions={
          <>
            <Button variant="outline" asChild><Link href={`/projects/${project.id}/edit`}>Edit</Link></Button>
            <Button asChild><Link href={`/invoices/new?projectId=${project.id}`}>Create invoice</Link></Button>
          </>
        }
      />
      <OfflineNotice />

      <KpiStrip items={detailKpis(project, milestonesQuery.data, today)} />

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {project.milestonesEnabled && <MilestonesPanel project={project} query={milestonesQuery} today={today} />}
          {type === "retainer" && (
            <RetainerSchedule
              project={project} periods={periodsQuery.data} isLoading={periodsQuery.isPending && periodsQuery.fetchStatus !== "idle"}
              error={periodsQuery.error} onRetry={() => void periodsQuery.refetch()} today={today}
            />
          )}
          {project.description && (
            <Card>
              <CardHead title="About this project" />
              <CardBody><p className="m-0 max-w-prose whitespace-pre-line text-sm text-muted-foreground [text-wrap:pretty]">{project.description}</p></CardBody>
            </Card>
          )}
          <Card>
            <CardHead title="Time and invoices" />
            <CardBody>
              <p className="m-0 text-sm text-muted-foreground">
                The hours logged against this project and its invoices arrive with the time and invoices updates. In the meantime, see{" "}
                <Link href="/time" className="font-medium text-primary-ink underline underline-offset-[3px]">Time</Link> and{" "}
                <Link href="/invoices" className="font-medium text-primary-ink underline underline-offset-[3px]">Invoices</Link>.
              </p>
            </CardBody>
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-6" aria-label="Client and details">
          <ProjectClientCard client={clientQuery.data} fallbackName={project.client.name} clientId={project.clientId} clientIds={clientIds} />
          <div className="flex flex-col gap-2 border-t border-rule pt-4">
            <DeleteProjectDialog name={project.name} onConfirm={onDelete} />
          </div>
        </aside>
      </div>
    </Page>
  );
}

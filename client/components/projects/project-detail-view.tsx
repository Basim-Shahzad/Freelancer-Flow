"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Link2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StageThread } from "@/components/domain/stage-thread";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFoot, CardHead, KpiStrip, Page, PageHeader } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDate, todayISO } from "@/lib/dates";
import { useCopy } from "@/lib/hooks/use-copy";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatMoney } from "@/lib/money";
import { byDateDesc, toInvoiceView } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import type { InvoiceView } from "@/lib/selectors";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { BILLING_LABEL, deriveStage, invoicedTotal, projectProgress, unbilledOf } from "./logic";
import { LinkedInvoices, LinkedTime, ProjectClientCard } from "./project-lists";
import { ProjectStatusChip } from "./project-status-chip";
import { hoursText, rateRow, rateSentence, relativeDays, type RateRow } from "./rate";
import { FixedSchedule, HourlySchedule, MilestoneSchedule, RetainerSchedule } from "./project-schedule";

/** Headline numbers for one project. Money stays in the project's own currency. */
function detailKpis(r: RateRow, views: InvoiceView[], today: string) {
  const p = r.project;
  const own = views.filter((v) => v.currency === p.currency && v.display !== "draft" && v.display !== "void");
  const paid = own.reduce((s, v) => s + v.totals.paid, 0);
  const out = own.reduce((s, v) => (v.display === "unpaid" || v.display === "partial" || v.display === "overdue" ? s + v.totals.balance : s), 0);
  const cur = (n: number) => formatMoney(n, p.currency);
  const fee = p.billingType === "hourly" ? { value: p.hourlyRate !== undefined ? `${cur(p.hourlyRate)} / h` : "—", label: "Hourly rate" }
    : p.billingType === "retainer" ? { value: p.retainerAmount !== undefined ? cur(p.retainerAmount) : "—", label: "Per month" }
      : { value: r.fee !== null ? cur(r.fee) : "—", label: p.billingType === "milestone" ? "Milestones total" : "Fixed fee" };
  const hours = { value: hoursText(r.minutes), label: r.buysMinutes !== null ? `Billable hours of ≈ ${hoursText(r.buysMinutes)} the fee buys` : "Billable hours logged" };
  const rate = r.kind === "hourly"
    ? { value: cur(r.notInvoiced), label: "Not invoiced yet" }
    : { value: r.rate !== null ? `${cur(r.rate)} / h` : "—", label: r.rate !== null ? "Effective hourly rate" : "Effective rate needs 1 h logged", tone: r.verdict === "below" ? ("bad" as const) : undefined };
  const due = r.due ? { value: fmtDate(r.due.date), label: `Due ${relativeDays(r.due.date, today)} · ${r.due.label}` } : { value: "—", label: "No due date" };
  return [fee, { value: cur(paid), label: "Paid" }, { value: cur(out), label: "Out with client" }, hours, rate, due];
}

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const project = useAppStore((s) => s.projects.find((p) => p.id === id));
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const invoices = useAppStore((s) => s.invoices);
  const time = useAppStore(useShallow((s) => s.time.filter((t) => t.projectId === id)));
  const hourlyRate = useAppStore((s) => s.business.hourlyRate);
  const base = useAppStore((s) => s.business.defaultCurrency);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const { copied, copy } = useCopy();
  const [gone, setGone] = useState(false);

  const views = useMemo(
    () => invoices.filter((i) => i.projectId === id).map((i) => toInvoiceView(i, clients, projects)).sort(byDateDesc),
    [invoices, clients, projects, id],
  );

  if (!hydrated || gone) return <PageSkeleton rows={3} />;
  if (!project) {
    return (
      <Page>
        <StateBlock kind="empty" title="Project not found" body="This project may have been deleted, or the link is wrong." cta={{ label: "Back to projects", href: "/projects" }} />
      </Page>
    );
  }

  const today = todayISO();
  const client = clients.find((c) => c.id === project.clientId);
  const stage = deriveStage(project, views, time, today);
  const progress = projectProgress(project, today);
  const row = rateRow(project, { time, views, today, own: { hourlyRate, defaultCurrency: base }, unbilledHourly: unbilledOf(project, time, today).amount });
  const sentence = rateSentence(row);
  const clientIds = clients.map((c) => c.id);
  const shareUrl = () => `${window.location.origin}/p/${project.shareToken}`;
  const onCopy = (key: string) => { void copy(key, shareUrl()); toast.success("Client link copied"); };
  const onDelete = () => {
    setGone(true);
    router.push("/projects");
    deleteProject(project.id);
    toast.success(`${project.name} deleted`);
  };
  const type = project.billingType;

  return (
    <Page>
      <PageHeader
        back={{ href: "/projects", label: "Projects" }}
        eyebrow={`${client?.name ?? "No client"} · ${BILLING_LABEL[type]}`}
        title={project.name}
        meta={<div className="flex flex-col items-start gap-2"><ProjectStatusChip status={project.status} />{sentence && <p className="m-0 max-w-[64ch]">{sentence}</p>}</div>}
        actions={
          <>
            <Button variant="outline" asChild><Link href={`/projects/${project.id}/edit`}>Edit</Link></Button>
            <Button variant="outline" onClick={() => onCopy("header")}><Link2 aria-hidden="true" />{copied === "header" ? "Link copied" : "Copy client link"}</Button>
            <Button variant="outline" asChild>
              <a href={`/p/${project.shareToken}`} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open client view<span className="sr-only"> (opens in a new tab)</span></a>
            </Button>
            <Button asChild><Link href={`/invoices/new?projectId=${project.id}`}>Create invoice</Link></Button>
          </>
        }
      />
      <OfflineNotice />

      <KpiStrip items={detailKpis(row, views, today)} />
      <Card role="region" aria-label="Stage">
        <CardBody><StageThread stage={stage.stage} caption={stage.caption} /></CardBody>
        {progress && (
          <CardFoot>
            <span><b className="num font-semibold text-foreground">{progress.pct}%</b> complete · {progress.basis}</span>
            {project.milestones.length === 0 && project.billingType !== "retainer" && <Link href={`/projects/${project.id}/edit`} className="font-medium text-primary-ink underline underline-offset-[3px]">Update progress</Link>}
          </CardFoot>
        )}
      </Card>

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {project.milestones.length > 0 && <MilestoneSchedule project={project} views={views} today={today} copied={copied} onCopy={onCopy} />}
          {type === "retainer" && <RetainerSchedule project={project} views={views} today={today} />}
          {type === "hourly" && <HourlySchedule project={project} time={time} />}
          {type === "fixed" && project.milestones.length === 0 && <FixedSchedule project={project} views={views} today={today} invoiced={invoicedTotal(views)} />}
        </div>
        <aside className="flex min-w-0 flex-col gap-6" aria-label="Invoices and client">
          <LinkedInvoices views={views} projectId={project.id} />
          <ProjectClientCard client={client} clientIds={clientIds} />
        </aside>
      </div>

      <LinkedTime time={time} project={project} views={views} />

      {project.notes && (
        <Card>
          <CardHead title="Notes" />
          <CardBody><p className="m-0 max-w-prose text-sm text-muted-foreground [text-wrap:pretty]">{project.notes}</p></CardBody>
        </Card>
      )}

      <div className="border-t border-rule pt-4"><DeleteProjectDialog name={project.name} invoices={views.length} onConfirm={onDelete} /></div>
    </Page>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { SelectField } from "@/components/ui/select";
import { Card, CardHead, KpiStrip, Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dates";
import { statusToApi } from "@/lib/api/mappers/projects";
import { useClientOptions } from "@/lib/hooks/clients";
import { useProjects } from "@/lib/hooks/projects";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatDuration } from "@/lib/money";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { ProjectStatus } from "@/lib/types";
import { ClientDot } from "./client-dot";
import { BILLING_LABEL, progressText, rateLabel, STATUS_LABEL } from "./logic";
import { ProjectStatusChip } from "./project-status-chip";
import { PROJECT_STATUSES } from "./schema";

const COLS = "minmax(0,1.6fr) minmax(0,.8fr) minmax(0,1.1fr) minmax(0,.5fr) minmax(0,.7fr) minmax(0,.6fr) 1.25rem";
const ALL = "";

export function ProjectsView() {
  const online = useAppStore((s) => s.online);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState(ALL);
  const [status, setStatus] = useState<ProjectStatus | typeof ALL>(ALL);
  const search = useDebouncedValue(q.trim(), 300);
  const query = useProjects({ search, clientId: clientId || undefined, status: status ? statusToApi(status) : undefined });
  // Colours are keyed to a client's position in the full list so they stay stable while filtering.
  const { clients } = useClientOptions();
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);

  const newBtn = <Button asChild><Link href="/projects/new"><Plus aria-hidden="true" />New project</Link></Button>;
  const { data } = query;

  if (query.isPending) {
    if (!online) return <Shell actions={newBtn}><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Shell>;
    return <Shell actions={newBtn}><div role="status" aria-label="Loading projects" className="flex flex-col gap-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div></Shell>;
  }
  if (query.isError && !data) {
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (!online) return <Shell actions={newBtn}><StateBlock kind="offline" cta={retry} /></Shell>;
    if (getApiErrorStatus(query.error) === 429) return <Shell actions={newBtn}><StateBlock kind="error" title="Too many requests" body="You’re going a little fast. Wait a moment and try again." cta={retry} /></Shell>;
    return <Shell actions={newBtn}><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Shell>;
  }

  const projects = data?.projects ?? [];
  const total = data?.total ?? 0;
  const filtering = search !== "" || q.trim() !== "" || clientId !== ALL || status !== ALL;

  if (total === 0 && !filtering) {
    return (
      <Shell actions={newBtn}>
        <StateBlock kind="empty" title="No projects yet" body="A project ties a client to how you bill: fixed price, hourly, retainer or milestones. Time and invoices hang off it." cta={{ label: "New project", href: "/projects/new" }} />
      </Shell>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={`${total} ${total === 1 ? "project" : "projects"}`} title="Projects" actions={newBtn} />
      <OfflineNotice />
      {!filtering && <KpiStrip items={[{ value: String(total), label: total === 1 ? "Project" : "Projects" }]} />}
      <Toolbar>
        <InputAffix className="min-w-0 flex-1 basis-64 @2xl:max-w-sm" prefix={<Search className="size-4" aria-hidden="true" />}>
          <Label className="sr-only" htmlFor="pj-q">Search projects</Label>
          <Input id="pj-q" type="search" placeholder="Search by project name" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputAffix>
        <SelectField
          aria-label="Filter by client" className="min-w-40" value={clientId} onValueChange={setClientId}
          options={[{ value: ALL, label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.companyName || c.name }))]}
        />
        <SelectField
          aria-label="Filter by status" className="min-w-40" value={status} onValueChange={(v) => setStatus(v as ProjectStatus | typeof ALL)}
          options={[{ value: ALL, label: "All statuses" }, ...PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
      </Toolbar>

      <Card>
        <CardHead title="Your projects" />
        <section aria-label="Project list" aria-busy={query.isFetching} className="px-5">
          <LedgerHead cols={COLS}>
            <span>Project</span><span>Status</span><span>Billing</span><span>Progress</span><span>Due</span><span>Time</span><span />
          </LedgerHead>
          {projects.map((p) => (
            <LedgerRow key={p.id} cols={COLS} href={`/projects/${p.id}`} className="last:border-b-0">
              <LCell>
                <LMain>{p.name}</LMain>
                <LSub className="mt-0.5 inline-flex items-center gap-1.5"><ClientDot clientId={p.clientId} clientIds={clientIds} />{p.client.name}</LSub>
                <LSub className="@2xl:hidden">{BILLING_LABEL[p.billingType]} · {rateLabel(p)}</LSub>
              </LCell>
              <LCell end className="@2xl:justify-self-start @2xl:text-start"><ProjectStatusChip status={p.status} /></LCell>
              <LCell narrow="hide"><span className="text-sm">{BILLING_LABEL[p.billingType]}</span><LSub className="num">{rateLabel(p)}</LSub></LCell>
              <LCell narrow="hide"><span className="num text-sm" aria-label={p.progressPercent === null ? "No progress yet" : undefined}>{progressText(p)}</span></LCell>
              <LCell narrow="hide"><span className="num text-sm text-muted-foreground">{p.dueDate ? fmtDate(p.dueDate) : "—"}</span></LCell>
              <LCell narrow="hide"><span className="num text-sm text-muted-foreground">{p.totalTimeSpentMinutes > 0 ? formatDuration(p.totalTimeSpentMinutes) : "—"}</span></LCell>
              <LCell narrow="hide"><ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /></LCell>
            </LedgerRow>
          ))}
          {projects.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground" role="status">{q.trim() ? `No projects match “${q.trim()}”.` : "No projects match these filters."}</p>
          )}
        </section>
        {query.hasNextPage && (
          <div className="flex items-center gap-3 px-5 pb-5">
            <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>
            <span className="text-sm text-muted-foreground">Showing {projects.length} of {total}</span>
          </div>
        )}
        {query.isFetchNextPageError && <p role="alert" className="px-5 pb-5 text-sm text-error-ink">{getApiErrorMessage(query.error, "Couldn’t load more projects.")}</p>}
      </Card>
    </Page>
  );
}

function Shell({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader eyebrow="Projects" title="Projects" actions={actions} />
      {children}
    </Page>
  );
}

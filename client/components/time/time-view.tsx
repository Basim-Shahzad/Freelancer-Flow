"use client";

import axios from "axios";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/domain/query-boundary";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select";
import type { BulkChange } from "@/lib/api/mappers/time-entries";
import { fmtDay, todayISO } from "@/lib/dates";
import { useClientOptions } from "@/lib/hooks/clients";
import { useProjectOptions } from "@/lib/hooks/projects";
import { useAllTimeEntries, useBulkUpdateTimeEntries, useDeleteTimeEntries, useRunningTimer } from "@/lib/hooks/time-entries";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatDuration } from "@/lib/money";
import { getApiErrorMessage } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Client, Project, TimeEntry } from "@/lib/types";
import { BulkBar } from "./bulk-bar";
import { ConflictPanel, RejectedPanel } from "./conflict-panel";
import { EntryForm } from "./entry-form";
import { EntryRow } from "./entry-row";
import {
  ALL_PROJECTS, DEFAULT_FILTERS, filterEntries, groupByDay, matchesFilters, weekTotalMinutes,
  type BillFilter, type InvoicedFilter, type TimeFilters,
} from "./logic";
import { projectLabel } from "./project-label";
import { RunningRow, useRunningMinutes } from "./running-row";
import { WeekView } from "./week-view";

type ViewMode = "week" | "list";

type Panel = { kind: "add" } | { kind: "edit"; entry: TimeEntry } | null;

/**
 * The Time screen. The API lists time per project (there is no "list all" endpoint), so entries are fetched for
 * every project and combined. The offline outbox is laid over them.
 */
export function TimeView() {
  const { projects, isLoading: projectsLoading, isError: projectsError } = useProjectOptions();
  const { clients } = useClientOptions();
  const currencyOf = useMemo(() => (id: string) => projects.find((p) => p.id === id)?.currency, [projects]);
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const entries = useAllTimeEntries(projectIds, currencyOf);
  const { running } = useRunningTimer(currencyOf);

  const query = {
    data: entries.data,
    isPending: projectsLoading || entries.isPending,
    isError: projectsError || entries.isError,
    error: entries.error,
    isFetching: entries.isFetching,
    refetch: () => entries.refetch(),
  };

  return (
    <Page>
      <QueryBoundary query={query} isEmpty={() => false}>
        {(time) => <TimeScreen time={time} projects={projects} clients={clients} running={running} />}
      </QueryBoundary>
    </Page>
  );
}

interface ScreenProps { time: TimeEntry[]; projects: Project[]; clients: Client[]; running: TimeEntry | null }

function TimeScreen({ time, projects, clients, running }: ScreenProps) {
  const online = useAppStore((s) => s.online);
  const bulk = useBulkUpdateTimeEntries();
  const remove = useDeleteTimeEntries();
  const { error } = useApiToast();

  const [filters, setFilters] = useState<TimeFilters>(DEFAULT_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<ViewMode>("week");

  const today = todayISO();
  const runningMinutes = useRunningMinutes(running?.startAt, Boolean(running));
  const showRunning = Boolean(running) && matchesFilters({ projectId: running?.projectId, billable: running?.billable ?? true, invoiced: false }, filters);

  const filtered = useMemo(() => filterEntries(time, filters), [time, filters]);
  const groups = useMemo(() => groupByDay(filtered, showRunning ? { date: today, minutes: runningMinutes } : undefined), [filtered, showRunning, today, runningMinutes]);
  const weekMinutes = useMemo(() => weekTotalMinutes(time, today, running ? runningMinutes : 0), [time, today, running, runningMinutes]);

  const label = (id?: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? projectLabel(p, clients) : "Unknown project";
  };
  const visibleIds = useMemo(() => new Set(filtered.filter((t) => !t.isInvoiced).map((t) => t.id)), [filtered]);
  const targets = [...selected].filter((id) => visibleIds.has(id));
  const targetEntries = time.filter((t) => targets.includes(t.id));
  const sharedProject = useMemo(() => {
    const ids = new Set(targetEntries.map((t) => t.projectId));
    const only = ids.size === 1 ? [...ids][0] : undefined;
    return projects.find((p) => p.id === only);
  }, [targetEntries, projects]);
  const hasAny = time.length > 0 || Boolean(running);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const setFilter = <K extends keyof TimeFilters>(k: K, v: TimeFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  /** 409 (invoiced), 404 (not yours) and 422 (milestone from another project) come back as the server's `detail`. */
  const showBulkError = (e: unknown) => {
    if (e instanceof Error && !axios.isAxiosError(e)) toast.error(e.message);
    else error(e, "Couldn’t update these entries.");
  };

  const applyBulk = (change: BulkChange, done: string) =>
    bulk.mutate({ ids: targets, change }, { onSuccess: () => { toast.success(done); exitSelect(); }, onError: showBulkError });

  const doDelete = () =>
    remove.mutate(targetEntries, {
      onSuccess: (r) => {
        const n = r.deleted + r.queued;
        if (n > 0) toast.success(`${n} ${n === 1 ? "entry" : "entries"} deleted`, { description: r.queued > 0 ? "Kept on this device. It uploads when you’re back online." : undefined });
        const failed = r.failed[0];
        if (failed) toast.error(`${r.failed.length} could not be deleted. ${getApiErrorMessage(failed.error, "Try again.")}`);
        setConfirmDelete(false);
        exitSelect();
      },
      onError: (e) => { error(e, "Couldn’t delete these entries."); setConfirmDelete(false); },
    });

  const weekMode = view === "week" && hasAny;
  const viewToggle = hasAny && (
    <Segmented<ViewMode> label="View" value={view} onChange={(v) => { setView(v); if (v === "week") exitSelect(); }} options={[{ value: "week", label: "Week" }, { value: "list", label: "List" }]} />
  );
  const addButton = <Button onClick={() => setPanel({ kind: "add" })}><Plus aria-hidden="true" />Add time</Button>;

  const offline = !online && (
    <Notice tone="warn" role="status">
      <b>You’re offline.</b> Entries you add are kept on this device and marked unsynced. They upload when you’re back online. Invoicing is paused until then.
    </Notice>
  );
  const entryForm = panel && (
    <EntryForm
      key={panel.kind === "edit" ? panel.entry.id : "add"}
      entry={panel.kind === "edit" ? panel.entry : undefined}
      projects={projects}
      clients={clients}
      defaultProjectId={filters.project !== ALL_PROJECTS ? filters.project : running?.projectId}
      onClose={() => setPanel(null)}
    />
  );
  const above = (
    <>
      {offline}
      <ConflictPanel />
      <RejectedPanel />
      {entryForm}
    </>
  );

  return (
    <>
      {weekMode ? (
        <WeekView
          time={time}
          projects={projects}
          clients={clients}
          running={running}
          actions={<>{viewToggle}{addButton}</>}
          between={above}
          onEdit={(entry) => setPanel({ kind: "edit", entry })}
        />
      ) : (
        <PageHeader
          eyebrow={`This week · ${formatDuration(weekMinutes)}`}
          title="Time"
          actions={
            <>
              {viewToggle}
              {hasAny && <Button variant="outline" aria-pressed={selectMode} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>{selectMode ? "Done" : "Select"}</Button>}
              {addButton}
            </>
          }
        />
      )}

      {!weekMode && above}

      {weekMode ? null : !hasAny ? (
        <StateBlock kind="empty" title="No time logged yet" body="Start the timer in the top bar, or add an entry by hand. Billable time can be pulled into an invoice in one tick." cta={{ label: "Add time", onClick: () => setPanel({ kind: "add" }) }} />
      ) : (
        <>
          <Toolbar>
            <Label className="sr-only" htmlFor="tm-proj">Project</Label>
            <SelectField
              id="tm-proj" className="w-auto min-w-44" value={filters.project} onValueChange={(v) => setFilter("project", v)}
              options={[{ value: ALL_PROJECTS, label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) }))]}
            />
            <Segmented<BillFilter> label="Billable" value={filters.billable} onChange={(v) => setFilter("billable", v)} options={[{ value: "all", label: "All" }, { value: "billable", label: "Billable" }, { value: "non-billable", label: "Non-billable" }]} />
            <Segmented<InvoicedFilter> label="Invoiced" value={filters.invoiced} onChange={(v) => setFilter("invoiced", v)} options={[{ value: "all", label: "All" }, { value: "uninvoiced", label: "Uninvoiced" }, { value: "invoiced", label: "Invoiced" }]} />
          </Toolbar>

          {groups.map((g) => (
            <section key={g.date} aria-label={fmtDay(g.date)} className="flex flex-col">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h2 className="t-h3">{g.date === today ? `Today · ${fmtDay(g.date)}` : fmtDay(g.date)}</h2>
                <span className="num text-sm text-muted-foreground">{formatDuration(g.minutes)}</span>
              </div>
              <div role="table" aria-label={`Entries for ${fmtDay(g.date)}`}>
                {g.date === today && showRunning && running && <RunningRow entry={running} project={label(running.projectId)} />}
                {g.entries.map((t) => (
                  <EntryRow
                    key={t.id}
                    entry={t}
                    project={label(t.projectId)}
                    selectMode={selectMode}
                    selected={selected.has(t.id)}
                    onToggle={toggle}
                    onEdit={(entry) => setPanel({ kind: "edit", entry })}
                  />
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="py-6 text-sm text-muted-foreground">No entries match these filters.</p>}

          {selectMode && (
            <BulkBar
              count={targets.length}
              projects={projects}
              clients={clients}
              sharedProject={sharedProject}
              busy={bulk.isPending}
              onChange={(change) => applyBulk(change, `Updated ${targets.length} ${targets.length === 1 ? "entry" : "entries"}`)}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete {targets.length} {targets.length === 1 ? "entry" : "entries"}?</DialogTitle>
          <DialogDescription>This can’t be undone. Invoiced entries are locked and are never deleted.</DialogDescription>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" loading={remove.isPending} onClick={doDelete}>Delete {targets.length}</Button>
            <DialogClose asChild><Button variant="ghost">Keep them</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

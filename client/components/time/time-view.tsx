"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { Notice } from "@/components/ui/notice";
import { Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtDay, todayISO } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatDuration } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { TimeEntry } from "@/lib/types";
import { BulkBar } from "./bulk-bar";
import { ConflictPanel } from "./conflict-panel";
import { EntryForm, projectLabel } from "./entry-form";
import { EntryRow } from "./entry-row";
import {
  ALL_PROJECTS, DEFAULT_FILTERS, NO_PROJECT, deriveConflicts, filterEntries, groupByDay, matchesFilters, weekTotalMinutes,
  type BillFilter, type InvoicedFilter, type TimeFilters,
} from "./logic";
import { RunningRow, useRunningMinutes } from "./running-row";
import { WeekView } from "./week-view";
import { Label } from "@/components/ui/label";

type ViewMode = "week" | "list";

type Panel = { kind: "add" } | { kind: "edit"; entry: TimeEntry } | null;

export function TimeView() {
  const hydrated = useHydrated();
  if (!hydrated) return <PageSkeleton rows={6} />;
  return <TimeScreen />;
}

function TimeScreen() {
  const time = useAppStore((s) => s.time);
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const invoices = useAppStore((s) => s.invoices);
  const timer = useAppStore((s) => s.timer);
  const online = useAppStore((s) => s.online);
  const bulkUpdateTime = useAppStore((s) => s.bulkUpdateTime);
  const deleteTime = useAppStore((s) => s.deleteTime);

  const [filters, setFilters] = useState<TimeFilters>(DEFAULT_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<ViewMode>("week");

  const today = todayISO();
  const runningMinutes = useRunningMinutes(timer.startedAt, timer.running);
  const showRunning = timer.running && matchesFilters({ projectId: timer.projectId, billable: true, invoiced: false }, filters);

  const filtered = useMemo(() => filterEntries(time, filters), [time, filters]);
  const groups = useMemo(() => groupByDay(filtered, showRunning ? { date: today, minutes: runningMinutes } : undefined), [filtered, showRunning, today, runningMinutes]);
  const weekMinutes = useMemo(() => weekTotalMinutes(time, today, timer.running ? runningMinutes : 0), [time, today, timer.running, runningMinutes]);
  const conflicts = useMemo(() => deriveConflicts(time), [time]);
  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, { id: i.id, number: i.number }])), [invoices]);

  const label = (id?: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? projectLabel(p, clients) : "Internal";
  };
  const visibleIds = useMemo(() => new Set(filtered.filter((t) => !t.invoiceId).map((t) => t.id)), [filtered]);
  const targets = [...selected].filter((id) => visibleIds.has(id));
  const hasAny = time.length > 0 || timer.running;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const setFilter = <K extends keyof TimeFilters>(k: K, v: TimeFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const doDelete = () => {
    deleteTime(targets);
    toast.success(`${targets.length} ${targets.length === 1 ? "entry" : "entries"} deleted`);
    setConfirmDelete(false);
    exitSelect();
  };

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
      defaultProjectId={filters.project !== ALL_PROJECTS && filters.project !== NO_PROJECT ? filters.project : timer.projectId}
      onClose={() => setPanel(null)}
    />
  );
  const above = (
    <>
      {offline}
      <ConflictPanel conflicts={conflicts} />
      {entryForm}
    </>
  );

  return (
    <Page>
      {weekMode ? (
        <WeekView
          time={time}
          projects={projects}
          clients={clients}
          invoices={invoices}
          timer={timer}
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
              options={[{ value: ALL_PROJECTS, label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) })), { value: NO_PROJECT, label: "No project (internal)" }]}
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
                {g.date === today && showRunning && <RunningRow project={label(timer.projectId)} />}
                {g.entries.map((t) => (
                  <EntryRow
                    key={t.id}
                    entry={t}
                    project={label(t.projectId)}
                    invoice={t.invoiceId ? invoiceById.get(t.invoiceId) : undefined}
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
              onProject={(projectId) => { bulkUpdateTime(targets, { projectId }); toast.success(`Moved ${targets.length} to ${label(projectId)}`); }}
              onBillable={(billable) => { bulkUpdateTime(targets, { billable }); toast.success(`Marked ${targets.length} ${billable ? "billable" : "non-billable"}`); }}
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
            <Button variant="destructive" onClick={doDelete}>Delete {targets.length}</Button>
            <DialogClose asChild><Button variant="ghost">Keep them</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}


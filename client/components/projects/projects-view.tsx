"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { Card, CardFoot, CardHead, KpiStrip, Page, PageHeader, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/dates";
import { FX_DISCLAIMER } from "@/lib/fx";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatMoney } from "@/lib/money";
import { toInvoiceView } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import { unbilledOf } from "./logic";
import { KpiMoney } from "./kpi-money";
import {
  billedByCurrency, blendedByCurrency, matchesRateFilter, rateRow, sortRateRows, splitByCurrency, type RateFilter, type RateSort,
} from "./rate";
import { RateLedgerRow } from "./rate-row";
import { Label } from "@/components/ui/label";

const FILTERS: { value: RateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "finished", label: "Finished" },
  { value: "all", label: "All" },
];
const SORTS: { value: RateSort; label: string }[] = [
  { value: "worst", label: "Worst rate first" },
  { value: "due", label: "Due soonest" },
  { value: "newest", label: "Newest" },
];

export function ProjectsView() {
  const hydrated = useHydrated();
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const invoices = useAppStore((s) => s.invoices);
  const time = useAppStore((s) => s.time);
  const hourlyRate = useAppStore((s) => s.business.hourlyRate);
  const base = useAppStore((s) => s.business.defaultCurrency);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<RateFilter>("open");
  const [sort, setSort] = useState<RateSort>("worst");

  const rows = useMemo(() => {
    const today = todayISO();
    const views = invoices.map((i) => toInvoiceView(i, clients, projects));
    return projects.map((p) => rateRow(p, { time, views, today, own: { hourlyRate, defaultCurrency: base }, unbilledHourly: unbilledOf(p, time, today).amount }));
  }, [projects, clients, invoices, time, hourlyRate, base]);
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);

  if (!hydrated) return <PageSkeleton />;

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const open = rows.filter((r) => r.open);
  const below = open.filter((r) => r.verdict === "below").length;
  const blended = blendedByCurrency(rows);
  const needle = q.trim().toLowerCase();
  const shown = sortRateRows(rows.filter((r) => matchesRateFilter(r, filter) && (!needle || `${r.project.name} ${nameOf(r.project.clientId)}`.toLowerCase().includes(needle))), sort);
  const anyEstimated = shown.some((r) => r.floor?.estimated && r.verdict);
  const newBtn = <Button asChild><Link href="/projects/new"><Plus aria-hidden="true" />New project</Link></Button>;

  if (projects.length === 0) {
    return (
      <Page>
        <PageHeader eyebrow="Projects" title="Projects" actions={newBtn} />
        <StateBlock kind="empty" title="No projects yet" body="A project ties a client to how you bill: fixed price, hourly, retainer or milestones. Time and invoices hang off it." cta={{ label: "New project", href: "/projects/new" }} />
      </Page>
    );
  }

  const kpis = [
    { value: String(open.length), label: "Open projects" },
    { value: Object.keys(blended).length ? <KpiMoney by={blended} base={base} /> : "—", label: "Blended hourly rate on fixed-fee work" },
    ...(hourlyRate ? [{ value: String(below), label: `Below your ${formatMoney(hourlyRate, base)} rate`, tone: below > 0 ? ("bad" as const) : undefined }] : []),
    { value: <KpiMoney by={billedByCurrency(rows)} base={base} />, label: "Billed so far on open projects" },
  ];
  const note = splitByCurrency(blended, base).others.length > 0 || splitByCurrency(billedByCurrency(rows), base).others.length > 0
    ? "Currencies are shown side by side and never added together." : null;

  return (
    <Page>
      <PageHeader eyebrow={`${open.length} open · ${rows.length - open.length} finished`} title="Projects" actions={newBtn} />
      <OfflineNotice />
      <KpiStrip items={kpis} />
      <Toolbar>
        <InputAffix className="min-w-0 flex-1 basis-64 @2xl:max-w-sm" prefix={<Search className="size-4" aria-hidden="true" />}>
          <Label className="sr-only" htmlFor="pj-q">Search projects</Label>
          <Input id="pj-q" type="search" placeholder="Search by project or client" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputAffix>
      </Toolbar>

      <Card>
        <CardHead
          title="What each project is actually paying you"
          sub={hourlyRate ? "Fee ÷ billable hours logged, set against your own hourly rate." : "Fee ÷ billable hours logged. Set “Your hourly rate” in Settings to see whether each project is above or below it."}
          action={<Segmented label="Show projects" value={filter} onChange={setFilter} options={FILTERS} />}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sort</span>
          <Segmented label="Sort projects" value={sort} onChange={setSort} options={SORTS} />
        </div>
        <section aria-label="Project list">
          {shown.map((r) => <RateLedgerRow key={r.project.id} r={r} clientName={nameOf(r.project.clientId)} clientIds={clientIds} />)}
          {shown.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground" role="status">
              {needle ? `No projects match “${q.trim()}”.` : filter === "finished" ? "No finished projects yet." : "No open projects."}
            </p>
          )}
        </section>
        <CardFoot>
          <span>Effective rate = fee ÷ billable hours logged so far. Hourly projects show your contract rate.</span>
          {(anyEstimated || note) && <span>{anyEstimated ? `${FX_DISCLAIMER}. ` : ""}{note}</span>}
        </CardFoot>
      </Card>
    </Page>
  );
}

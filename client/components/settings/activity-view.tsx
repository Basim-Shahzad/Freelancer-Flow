"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Section, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { fmtDateTime } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { DEFAULT_FILTER, filterActivity, isFiltered, SEGMENTS, TYPE_LABEL, type ActivityFilter, type ActivityRange } from "./activity-filter";
import { SettingsSkeleton } from "./settings-skeleton";
import { Label } from "@/components/ui/label";

const COLS = "10.5rem minmax(0,1.3fr) minmax(0,1fr) minmax(0,2fr)";
const PAGE = 50;

export function ActivityView() {
  const hydrated = useHydrated();
  const activity = useAppStore((s) => s.activity);
  const [filter, setFilter] = useState<ActivityFilter>(DEFAULT_FILTER);
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo(() => filterActivity(activity, filter), [activity, filter]);
  if (!hydrated) return <SettingsSkeleton rows={8} />;

  const set = (patch: Partial<ActivityFilter>) => { setFilter((f) => ({ ...f, ...patch })); setShown(PAGE); };
  const showType = filter.segment === "all";

  return (
    <Section title="Activity log" id="st-l" action={<span className="text-sm text-muted-foreground">Read-only · kept for audit</span>}>
      <Toolbar>
        <InputAffix prefix={<Search className="size-4" aria-hidden="true" />} className="w-full @xl:w-72">
          <Label className="sr-only" htmlFor="lg-q">Search log</Label>
          <Input id="lg-q" type="search" placeholder="Invoice number or detail" value={filter.query} onChange={(e) => set({ query: e.target.value })} />
        </InputAffix>
        <Label className="sr-only" htmlFor="lg-r">Date range</Label>
        <SelectField
          id="lg-r" className="w-auto" value={filter.range} onValueChange={(range) => set({ range: range as ActivityRange })}
          options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "all", label: "All time" }]}
        />
        <Segmented label="Type" value={filter.segment} onChange={(segment) => set({ segment })} options={SEGMENTS} />
      </Toolbar>

      <p role="status" className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "entry" : "entries"}, newest first</p>

      {rows.length === 0 ? (
        <StateBlock
          kind="empty"
          title={isFiltered(filter) ? "No activity matches these filters" : "No activity yet"}
          body={isFiltered(filter) ? "Try a wider date range or a different type." : "Invoices, payments and changes you make are recorded here as they happen."}
          cta={isFiltered(filter) ? { label: "Clear filters", onClick: () => set({ ...DEFAULT_FILTER, range: "all" }) } : undefined}
        />
      ) : (
        <div role="table" aria-label="Activity log">
          <LedgerHead cols={COLS}>
            <LCell role="columnheader">When</LCell><LCell role="columnheader">Action</LCell><LCell role="columnheader">Record</LCell><LCell role="columnheader">Detail</LCell>
          </LedgerHead>
          {rows.slice(0, shown).map((r) => (
            <LedgerRow key={r.id} cols={COLS}>
              <LCell end className="num col-start-2 row-start-1 text-xs text-muted-foreground @2xl:col-auto @2xl:row-auto @2xl:justify-self-start @2xl:text-start @2xl:text-sm">{fmtDateTime(r.at)}</LCell>
              <LCell className="col-start-1 row-start-1 @2xl:col-auto @2xl:row-auto">
                <LMain className="font-medium">{r.action}</LMain>
                {showType && <LSub>{TYPE_LABEL[r.type]}</LSub>}
              </LCell>
              <LCell narrow="full" className="num text-sm">{r.record}</LCell>
              <LCell narrow="full" className="text-sm text-muted-foreground">{r.detail}</LCell>
            </LedgerRow>
          ))}
        </div>
      )}

      {rows.length > shown && (
        <div><Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show more ({rows.length - shown} left)</Button></div>
      )}
    </Section>
  );
}

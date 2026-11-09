"use client";

import Link from "next/link";
import { useState } from "react";
import { OfflineNotice } from "@/components/auth/form-bits";
import { StateBlock } from "@/components/domain/state-block";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LCell, LedgerHead, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Section, Toolbar } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select";
import { activityHref, actionLabel, DEFAULT_FILTER, describeChanges, entityLabel, isFiltered, SEGMENTS, type ActivityFilter, type ActivityRange } from "@/lib/api/mappers/activity";
import { fmtDateTime } from "@/lib/dates";
import { useActivityFeed } from "@/lib/hooks/activity/use-activity";
import { useAppStore } from "@/lib/store";
import { SettingsSkeleton } from "./settings-skeleton";

const COLS = "10.5rem minmax(0,1.3fr) minmax(0,1fr) minmax(0,2fr)";

export function ActivityView() {
  const online = useAppStore((s) => s.online);
  const [filter, setFilter] = useState<ActivityFilter>(DEFAULT_FILTER);
  const q = useActivityFeed(filter);
  const rows = q.data?.pages.flatMap((p) => p.events) ?? [];
  const total = q.data?.pages[0]?.total ?? rows.length;
  const set = (patch: Partial<ActivityFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const filtered = isFiltered(filter);

  return (
    <Section title="Activity log" id="st-l" action={<span className="text-sm text-muted-foreground">Read-only · kept for audit</span>}>
      <Toolbar>
        <Label className="sr-only" htmlFor="lg-r">Date range</Label>
        <SelectField
          id="lg-r" className="w-auto" value={filter.range} onValueChange={(range) => set({ range: range as ActivityRange })}
          options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "all", label: "All time" }]}
        />
        <Segmented label="Type" value={filter.segment} onChange={(segment) => set({ segment })} options={SEGMENTS} />
      </Toolbar>

      {!online && <OfflineNotice>You’re offline. Showing what was already loaded; reconnect for the latest.</OfflineNotice>}

      {q.isPending ? (
        !online && !q.data ? <StateBlock kind="offline" title="You’re offline" body="Reconnect to load your activity log." /> : <SettingsSkeleton rows={8} />
      ) : q.isError && rows.length === 0 ? (
        <StateBlock kind="error" title="Couldn’t load activity" cta={{ label: "Try again", onClick: () => void q.refetch() }} />
      ) : rows.length === 0 ? (
        <StateBlock
          kind="empty"
          title={filtered ? "No activity matches these filters" : "No activity yet"}
          body={filtered ? "Try a wider date range or a different type." : "Invoices, payments and changes you make are recorded here as they happen."}
          cta={filtered ? { label: "Clear filters", onClick: () => set({ ...DEFAULT_FILTER, range: "all" }) } : undefined}
        />
      ) : (
        <>
          <p role="status" className="text-xs text-muted-foreground">{total} {total === 1 ? "entry" : "entries"}, newest first</p>
          <div role="table" aria-label="Activity log">
            <LedgerHead cols={COLS}>
              <LCell role="columnheader">When</LCell><LCell role="columnheader">Action</LCell><LCell role="columnheader">Record</LCell><LCell role="columnheader">Detail</LCell>
            </LedgerHead>
            {rows.map((r) => {
              const lines = describeChanges(r.changes);
              return (
                <LedgerRow key={r.id} cols={COLS}>
                  <LCell end className="num col-start-2 row-start-1 text-xs text-muted-foreground @2xl:col-auto @2xl:row-auto @2xl:justify-self-start @2xl:text-start @2xl:text-sm">{fmtDateTime(r.createdAt)}</LCell>
                  <LCell className="col-start-1 row-start-1 @2xl:col-auto @2xl:row-auto">
                    <LMain className="font-medium">{actionLabel(r.action)}</LMain>
                    <LSub>{entityLabel(r.entityType)}</LSub>
                  </LCell>
                  <LCell narrow="full" className="text-sm">
                    <Link href={activityHref(r.entityType, r.entityId)} className="font-medium text-primary-ink underline underline-offset-[3px]">View {entityLabel(r.entityType).toLowerCase()}</Link>
                  </LCell>
                  <LCell narrow="full" className="text-sm text-muted-foreground">
                    <span>{r.summary}</span>
                    {lines.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs">What changed</summary>
                        <ul className="m-0 list-none p-0 text-xs">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
                      </details>
                    )}
                  </LCell>
                </LedgerRow>
              );
            })}
          </div>
          {q.isError && <p role="alert" className="text-sm text-error-ink">Couldn’t load more activity.</p>}
          {q.hasNextPage && (
            <div><Button variant="outline" loading={q.isFetchingNextPage} disabled={q.isFetchingNextPage || !online} onClick={() => void q.fetchNextPage()}>Load more</Button></div>
          )}
        </>
      )}
    </Section>
  );
}

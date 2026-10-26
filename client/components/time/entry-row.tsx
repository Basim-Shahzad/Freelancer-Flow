"use client";

import { Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Tag } from "@/components/ui/tag";
import { formatDuration } from "@/lib/money";
import type { TimeEntry } from "@/lib/types";

export const ENTRY_COLS = "minmax(0,2.6fr) minmax(0,1.4fr) minmax(0,1.2fr) 9rem";

interface Props {
  entry: TimeEntry;
  /** "Harbor Labs · Mobile app". */
  project: string;
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onEdit: (entry: TimeEntry) => void;
}

function InvoicedTag() {
  return <Tag tone="primary" className="gap-1"><Lock className="size-3" aria-hidden="true" />Invoiced</Tag>;
}

/** Tags are rendered twice: under the title in narrow containers, in their own columns when wide. */
function Tags({ entry }: { entry: TimeEntry }) {
  return (
    <>
      <Tag>{entry.billable ? "Billable" : "Non-billable"}</Tag>
      {entry.isInvoiced && <InvoicedTag />}
      {entry.overlap && <Tag tone="warning">Overlaps another entry</Tag>}
      {entry.unsynced && <Tag tone="warning">Unsynced</Tag>}
    </>
  );
}

export function EntryRow({ entry, project, selectMode, selected, onToggle, onEdit }: Props) {
  const locked = entry.isInvoiced;
  return (
    <LedgerRow cols={ENTRY_COLS} selected={selected}>
      <LCell className="flex items-start gap-3">
        {selectMode && (
          <Checkbox
            checked={selected}
            disabled={locked}
            onCheckedChange={() => onToggle(entry.id)}
            aria-label={locked ? `${entry.description} is invoiced and locked` : `Select ${entry.description}`}
            className="mt-0.5 size-5"
          />
        )}
        <div className="min-w-0">
          <LMain>{entry.description}</LMain>
          <LSub>{project}</LSub>
          <div className="mt-1.5 flex flex-wrap gap-1.5 @2xl:hidden"><Tags entry={entry} /></div>
        </div>
      </LCell>
      <LCell narrow="hide"><div className="flex flex-wrap gap-1.5"><Tag>{entry.billable ? "Billable" : "Non-billable"}</Tag>{entry.isInvoiced && <InvoicedTag />}</div></LCell>
      <LCell narrow="hide">
        <div className="flex flex-wrap gap-1.5">
          {entry.overlap && <Tag tone="warning">Overlaps another entry</Tag>}
          {entry.unsynced && <Tag tone="warning">Unsynced</Tag>}
        </div>
      </LCell>
      <LCell end className="flex items-center justify-end gap-1">
        <span className="num font-semibold">{formatDuration(entry.minutes)}</span>
        {locked ? (
          <Button variant="ghost" size="icon-sm" aria-label={`${entry.description} is locked to an invoice. View`} title="Invoiced entries are locked" onClick={() => onEdit(entry)}>
            <Lock aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${entry.description}`} onClick={() => onEdit(entry)}><Pencil aria-hidden="true" /></Button>
        )}
      </LCell>
    </LedgerRow>
  );
}

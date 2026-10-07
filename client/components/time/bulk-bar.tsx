"use client";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import type { Client, Project } from "@/lib/types";
import { projectLabel } from "./entry-form";

interface Props {
  count: number;
  projects: Project[];
  clients: Client[];
  onProject: (projectId: string | undefined) => void;
  onBillable: (billable: boolean) => void;
  onDelete: () => void;
}

const NONE = "__none";

/** Sticky bulk-action bar shown in select mode. Invoiced entries can't be selected so are never affected. */
export function BulkBar({ count, projects, clients, onProject, onBillable, onDelete }: Props) {
  const disabled = count === 0;
  return (
    <div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-surface px-4 py-3">
      <span className="font-semibold" aria-live="polite">{count} selected</span>
      <SelectField
        aria-label="Change project"
        value=""
        placeholder="Change project…"
        disabled={disabled}
        onValueChange={(v) => { if (v) onProject(v === NONE ? undefined : v); }}
        options={[...projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) })), { value: NONE, label: "No project (internal)" }]}
        className="min-h-9 w-auto text-sm"
      />
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onBillable(false)}>Mark non-billable</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onBillable(true)}>Mark billable</Button>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>Delete{count > 0 ? ` ${count}` : ""}</Button>
      <span className="text-xs text-muted-foreground">Invoiced entries are locked and can’t be edited or deleted.</span>
    </div>
  );
}

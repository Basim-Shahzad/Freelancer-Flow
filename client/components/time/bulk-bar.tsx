"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import type { BulkChange } from "@/lib/api/mappers/time-entries";
import { MAX_BATCH } from "@/lib/api/time-entries.types";
import { useMilestones } from "@/lib/hooks/milestones";
import type { Client, Project } from "@/lib/types";
import { projectLabel } from "./project-label";

interface Props {
  count: number;
  projects: Project[];
  clients: Client[];
  /** The one project every selected entry belongs to, when they share one; enables the milestone setter. */
  sharedProject?: Project;
  busy?: boolean;
  /** One all-or-nothing change for every selected entry. */
  onChange: (change: BulkChange) => void;
  onDelete: () => void;
}

const NO_MILESTONE = "__none";

function MilestoneSetter({ project, disabled, onChange }: { project: Project; disabled: boolean; onChange: Props["onChange"] }) {
  const milestones = useMilestones(project.id, project.currency, project.milestonesEnabled);
  return (
    <SelectField
      aria-label="Set milestone"
      value=""
      placeholder="Set milestone…"
      disabled={disabled || !milestones.data}
      onValueChange={(v) => { if (v) onChange({ milestoneId: v === NO_MILESTONE ? null : v }); }}
      options={[{ value: NO_MILESTONE, label: "No milestone" }, ...(milestones.data ?? []).map((m) => ({ value: m.id, label: m.title }))]}
      className="min-h-9 w-auto text-sm"
    />
  );
}

/**
 * Sticky bulk-action bar shown in select mode. Invoiced entries can't be selected. Each action is one call for the
 * whole selection (at most 200 entries); the server answers 409 / 404 / 422 for the whole batch, shown by the caller.
 */
export function BulkBar({ count, projects, clients, sharedProject, busy, onChange, onDelete }: Props) {
  const [description, setDescription] = useState("");
  const tooMany = count > MAX_BATCH;
  const disabled = count === 0 || tooMany || Boolean(busy);
  return (
    <div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-surface px-4 py-3">
      <span className="font-semibold" aria-live="polite">{count} selected</span>
      <SelectField
        aria-label="Change project"
        value=""
        placeholder="Change project…"
        disabled={disabled}
        onValueChange={(v) => { if (v) onChange({ projectId: v }); }}
        options={projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) }))}
        className="min-h-9 w-auto text-sm"
      />
      {sharedProject?.milestonesEnabled && <MilestoneSetter project={sharedProject} disabled={disabled} onChange={onChange} />}
      <Label className="sr-only" htmlFor="bb-desc">New description</Label>
      <Input id="bb-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="New description" className="min-h-9 w-44 text-sm" />
      <Button variant="outline" size="sm" disabled={disabled || !description.trim()} onClick={() => { onChange({ description }); setDescription(""); }}>Set description</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ billable: false })}>Mark non-billable</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ billable: true })}>Mark billable</Button>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>Delete{count > 0 ? ` ${count}` : ""}</Button>
      <span className="text-xs text-muted-foreground">
        {tooMany ? `Bulk edit takes at most ${MAX_BATCH} entries at a time. Select fewer.` : "Invoiced entries are locked and can’t be selected."}
      </span>
    </div>
  );
}

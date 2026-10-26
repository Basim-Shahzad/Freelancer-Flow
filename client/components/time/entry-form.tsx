"use client";

import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { todayISO } from "@/lib/dates";
import { useCreateTimeEntry, useUpdateTimeEntry } from "@/lib/hooks/time-entries";
import { useMilestones } from "@/lib/hooks/milestones";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatDuration, formatMoney, parseDuration } from "@/lib/money";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Client, Project, TimeEntry } from "@/lib/types";
import { projectLabel } from "./project-label";
import { entrySchema, type EntryFormValues } from "./schema";

export { projectLabel } from "./project-label";

/** Prefill for a new entry: the current time rounded down to 15 minutes, a calm default the user can overwrite. */
const defaultStart = (): string => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(Math.floor(n.getMinutes() / 15) * 15).padStart(2, "0")}`;
};

/** API field names that differ from the form's. */
const FIELD_ALIASES = { endTime: "duration" };

interface Props {
  /** Entry being edited; undefined = add. */
  entry?: TimeEntry;
  projects: Project[];
  clients: Client[];
  defaultProjectId?: string;
  onClose: () => void;
}

/**
 * Add / edit panel. Validation with zod; duration accepts "1.5", "1:30" or "90m". A project is required (the API has
 * no internal time) and cannot change on an existing entry (use bulk edit). An invoiced entry is locked.
 */
export function EntryForm({ entry, projects, clients, defaultProjectId, onClose }: Props) {
  const currencyOf = useMemo(() => (id: string) => projects.find((p) => p.id === id)?.currency, [projects]);
  const create = useCreateTimeEntry(currencyOf);
  const update = useUpdateTimeEntry(currencyOf);
  const { error } = useApiToast();
  const online = useAppStore((s) => s.online);
  const ref = useRef<HTMLElement>(null);
  const locked = Boolean(entry?.isInvoiced);
  const defaultProject = entry ? entry.projectId ?? "" : defaultProjectId ?? "";
  const startProject = projects.find((p) => p.id === defaultProject);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      description: entry?.description ?? "",
      projectId: defaultProject,
      milestoneId: entry?.milestoneId ?? "",
      date: entry?.date ?? todayISO(),
      duration: entry ? formatDuration(entry.minutes) : "",
      startTime: entry ? entry.startTime ?? "" : defaultStart(),
      billable: entry ? entry.billable : Boolean(startProject),
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = form;
  const projectId = watch("projectId");
  const project = projects.find((p) => p.id === projectId);
  const milestones = useMilestones(project?.id, project?.currency ?? "USD", Boolean(project?.milestonesEnabled));
  const milestoneOptions = useMemo(
    () => [{ value: "", label: "No milestone" }, ...(milestones.data ?? []).map((m) => ({ value: m.id, label: m.title }))],
    [milestones.data],
  );

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (!projectId) setValue("billable", false); }, [projectId, setValue]);

  const rateText = !project ? "Choose a project first"
    : project.billingType === "hourly" && project.hourlyRate ? `Billable at ${formatMoney(project.hourlyRate, project.currency)} / h`
    : "Billable (counts towards the project's billing)";

  const submit = handleSubmit(async (v) => {
    const input = {
      description: v.description.trim(), projectId: v.projectId, milestoneId: project?.milestonesEnabled ? v.milestoneId : "",
      date: v.date, startTime: v.startTime || entry?.startTime || "09:00", minutes: parseDuration(v.duration) ?? 0, billable: v.billable,
    };
    try {
      const r = entry ? await update.mutateAsync({ entry, input }) : await create.mutateAsync(input);
      toast.success(entry ? "Entry updated" : "Entry added", { description: r.queued ? "Kept on this device. It uploads when you’re back online." : undefined });
      onClose();
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 409) error(e, "This entry is locked.");
      else if (status === 404) error(e, "This entry no longer exists.");
      else if (!applyApiFieldErrors(form, e, FIELD_ALIASES)) error(e, "Couldn’t save this entry.");
    }
  });

  const title = entry ? "Edit time entry" : "Add time entry";
  const rootError = errors.root?.message;
  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="tm-form-title" className="flex flex-col gap-4 border-y border-rule py-4 outline-none">
      <h2 id="tm-form-title" className="t-h3">{title}</h2>
      {locked && <Notice tone="info" role="status">This entry is on an invoice, so it is locked. Void the invoice to edit or delete it.</Notice>}
      {!online && !locked && <Notice tone="warn" role="status">You’re offline. This entry is kept on this device and uploads when you’re back online.</Notice>}
      {rootError && <Notice tone="error" role="alert">{rootError}</Notice>}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <fieldset disabled={locked} className="m-0 grid min-w-0 gap-4 border-0 p-0 @2xl:grid-cols-2">
          <Field label="Description" htmlFor="ta-d" error={errors.description?.message} className="@2xl:col-span-2">
            <Input id="ta-d" placeholder="What did you work on?" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "ta-d-error" : undefined} {...register("description")} />
          </Field>
          <Field label="Project" htmlFor="ta-p" error={errors.projectId?.message} hint={entry ? "To move an entry to another project, use Select → Change project." : undefined}>
            <FormSelect
              id="ta-p" control={control} name="projectId" placeholder="Choose a project…" disabled={Boolean(entry)}
              onChange={() => setValue("milestoneId", "")}
              options={projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) }))}
            />
          </Field>
          {project?.milestonesEnabled && (
            <Field label="Milestone (optional)" htmlFor="ta-m" error={errors.milestoneId?.message}>
              <FormSelect id="ta-m" control={control} name="milestoneId" options={milestoneOptions} />
            </Field>
          )}
          <Field label="Date" htmlFor="ta-dt" error={errors.date?.message}>
            <Input id="ta-dt" type="date" aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "ta-dt-error" : undefined} {...register("date")} />
          </Field>
          <Field label="Start time (optional)" htmlFor="ta-st" error={errors.startTime?.message}>
            <Input id="ta-st" type="time" aria-invalid={Boolean(errors.startTime)} aria-describedby={errors.startTime ? "ta-st-error" : undefined} {...register("startTime")} />
          </Field>
          <Field label="Duration" htmlFor="ta-du" hint="Type 1.5, 1:30 or 90m" error={errors.duration?.message}>
            <Input id="ta-du" inputMode="text" autoComplete="off" placeholder="1h 30m" aria-invalid={Boolean(errors.duration)} aria-describedby={errors.duration ? "ta-du-error" : "ta-du-hint"} {...register("duration")} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Billable</span>
            <Controller control={control} name="billable" render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!projectId || locked} label={rateText} />
            )} />
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {!locked && <Button type="submit" loading={isSubmitting}>{entry ? "Save changes" : "Save entry"}</Button>}
          <Button type="button" variant="ghost" onClick={onClose}>{locked ? "Close" : "Cancel"}</Button>
        </div>
      </form>
    </section>
  );
}

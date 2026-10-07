"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { todayISO } from "@/lib/dates";
import { formatDuration, formatMoney, parseDuration } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { Client, Project, TimeEntry } from "@/lib/types";
import { entrySchema, type EntryFormValues } from "./schema";

/** Prefill for a new entry: the current time rounded down to 15 minutes, a calm default the user can overwrite. */
const defaultStart = (): string => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(Math.floor(n.getMinutes() / 15) * 15).padStart(2, "0")}`;
};

export const projectLabel = (p: Project, clients: Client[]) => {
  const c = clients.find((x) => x.id === p.clientId);
  return c ? `${c.name} · ${p.name}` : p.name;
};

interface Props {
  /** Entry being edited; undefined = add. */
  entry?: TimeEntry;
  projects: Project[];
  clients: Client[];
  defaultProjectId?: string;
  onClose: () => void;
}

/** Add / edit panel. Validation with zod; duration accepts "1.5", "1:30" or "90m". */
export function EntryForm({ entry, projects, clients, defaultProjectId, onClose }: Props) {
  const addTime = useAppStore((s) => s.addTime);
  const updateTime = useAppStore((s) => s.updateTime);
  const online = useAppStore((s) => s.online);
  const ref = useRef<HTMLElement>(null);
  const defaultProject = entry ? entry.projectId ?? "" : defaultProjectId ?? "";
  const startProject = projects.find((p) => p.id === defaultProject);

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      description: entry?.description ?? "",
      projectId: defaultProject,
      date: entry?.date ?? todayISO(),
      duration: entry ? formatDuration(entry.minutes) : "",
      startTime: entry ? entry.startTime ?? "" : defaultStart(),
      billable: entry ? entry.billable : Boolean(startProject),
    },
  });
  const projectId = watch("projectId");
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (!projectId) setValue("billable", false); }, [projectId, setValue]);

  const rateText = !project ? "Internal time is non-billable"
    : project.billingType === "hourly" && project.hourlyRate ? `Billable at ${formatMoney(project.hourlyRate, project.currency)} / h`
    : "Billable (counts towards the project's billing)";

  const submit = handleSubmit((v) => {
    const minutes = parseDuration(v.duration) ?? 0;
    const base = { description: v.description.trim(), projectId: v.projectId || undefined, date: v.date, startTime: v.startTime || undefined, minutes, billable: v.projectId ? v.billable : false };
    if (entry) updateTime(entry.id, base);
    else addTime(base);
    toast.success(entry ? "Entry updated" : "Entry added", { description: online ? undefined : "Kept on this device. It uploads when you’re back online." });
    onClose();
  });

  const title = entry ? "Edit time entry" : "Add time entry";
  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="tm-form-title" className="flex flex-col gap-4 border-y border-rule py-4 outline-none">
      <h2 id="tm-form-title" className="t-h3">{title}</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <Field label="Description" htmlFor="ta-d" error={errors.description?.message} className="@2xl:col-span-2">
            <Input id="ta-d" placeholder="What did you work on?" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "ta-d-error" : undefined} {...register("description")} />
          </Field>
          <Field label="Project" htmlFor="ta-p" error={errors.projectId?.message}>
            <FormSelect id="ta-p" control={control} name="projectId" options={[...projects.map((p) => ({ value: p.id, label: projectLabel(p, clients) })), { value: "", label: "No project (internal)" }]} />
          </Field>
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
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!projectId} label={rateText} />
            )} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={isSubmitting}>{entry ? "Save changes" : "Save entry"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}

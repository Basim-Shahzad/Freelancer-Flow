"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DiscardDialog, describedBy, useUnsavedChanges } from "@/components/clients/form-parts";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/checkbox";
import { Input, InputAffix } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Section } from "@/components/ui/section";
import { useAppStore } from "@/lib/store";
import { CURRENCIES, type BillingType, type Project } from "@/lib/types";
import { BillingFields } from "./billing-fields";
import { STATUS_LABEL } from "./logic";
import { MilestonesEditor } from "./milestones-editor";
import { emptyProjectForm, emptyRow, formToProject, projectResolver, projectToForm, type ProjectFormValues } from "./schema";

const TYPES: { value: BillingType; title: string; desc: string }[] = [
  { value: "fixed", title: "Fixed price", desc: "One agreed price, invoiced in full or in stages." },
  { value: "hourly", title: "Hourly", desc: "Tracked time multiplied by your rate." },
  { value: "retainer", title: "Retainer", desc: "A recurring amount for each month." },
  { value: "milestone", title: "Milestones", desc: "Staged delivery. Each approved milestone gets its own invoice." },
];
const grid = "grid gap-5 @2xl:grid-cols-2";

export function ProjectForm({ project, clientId }: { project?: Project; clientId?: string }) {
  const router = useRouter();
  const clients = useAppStore((s) => s.clients);
  const base = useAppStore((s) => s.business.defaultCurrency);
  const online = useAppStore((s) => s.online);
  const addProject = useAppStore((s) => s.addProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: projectResolver,
    defaultValues: project ? projectToForm(project) : emptyProjectForm(clients, base, clientId),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, getValues, setValue, formState: { errors, isDirty, isSubmitting, submitCount } } = form;
  const type = useWatch({ control, name: "billingType" });
  const currency = useWatch({ control, name: "currency" });
  const msCount = useWatch({ control, name: "milestones" }).length;
  useUnsavedChanges(isDirty && !saved);

  const lockedIds = new Set((project?.milestones ?? []).filter((m) => m.status !== "upcoming" || m.invoiceId).map((m) => m.id));
  const back = project ? `/projects/${project.id}` : "/projects";
  const errorCount = Object.keys(errors).length;

  const onSubmit = (values: ProjectFormValues) => {
    const data = formToProject(values, project);
    setSaved(true);
    if (project) {
      updateProject(project.id, data);
      toast.success(`${data.name} saved`);
      router.push(back);
    } else {
      const created = addProject(data);
      toast.success(`${created.name} created`);
      router.push(`/projects/${created.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-11">
      {submitCount > 0 && errorCount > 0 && <Notice tone="error" role="alert">{errorCount === 1 ? "One field needs attention before you can save." : `${errorCount} fields need attention before you can save.`}</Notice>}
      {!online && <Notice tone="warn">You’re offline. This project is saved on this device and syncs when you reconnect.</Notice>}

      <Section title="Basics" level={3} id="pf-basics">
        <div className={grid}>
          <Field className="@2xl:col-span-2" label="Project name" htmlFor="pf-name" error={errors.name?.message}>
            <Input id="pf-name" placeholder="Brand site" aria-invalid={!!errors.name} aria-describedby={describedBy("pf-name", errors.name?.message, false)} {...register("name")} />
          </Field>
          <Field label="Client" htmlFor="pf-client" error={errors.clientId?.message}>
            <FormSelect
              id="pf-client" aria-invalid={!!errors.clientId} aria-describedby={describedBy("pf-client", errors.clientId?.message, false)}
              control={control} name="clientId" placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(id) => { const c = clients.find((x) => x.id === id); if (c && !project) setValue("currency", c.currency, { shouldDirty: true }); }}
            />
          </Field>
          <Field label="Currency" htmlFor="pf-cur">
            <FormSelect id="pf-cur" control={control} name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Start date" htmlFor="pf-start" error={errors.startDate?.message}>
            <Input id="pf-start" type="date" className="num" aria-invalid={!!errors.startDate} aria-describedby={describedBy("pf-start", errors.startDate?.message, false)} {...register("startDate")} />
          </Field>
          <Field label="Status" htmlFor="pf-status">
            <FormSelect id="pf-status" control={control} name="status" options={(Object.keys(STATUS_LABEL) as Project["status"][]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          </Field>
          <Field className="@2xl:col-span-2" label="Scope and notes" htmlFor="pf-notes" optional>
            <Textarea id="pf-notes" placeholder="What’s included, and what isn’t." {...register("notes")} />
          </Field>
        </div>
      </Section>

      <Section title="How you bill" level={3} id="pf-billing">
        <Controller
          control={control}
          name="billingType"
          render={({ field }) => (
            <RadioGroup
              aria-label="Billing type" value={field.value} className="border-t border-border"
              onValueChange={(v) => { field.onChange(v); if (v === "milestone" && getValues("milestones").length === 0) setValue("milestones", [emptyRow(), emptyRow()], { shouldDirty: true }); }}
            >
              {TYPES.map((t) => (
                <ChoiceRow key={t.value}>
                  <RadioItem value={t.value} />
                  <span><span className="block font-medium">{t.title}</span><span className="t-caption">{t.desc}</span></span>
                </ChoiceRow>
              ))}
            </RadioGroup>
          )}
        />
        <BillingFields type={type} currency={currency} register={register} errors={errors} />
      </Section>

      <MilestonesEditor control={control} register={register} errors={errors} lockedIds={lockedIds} />

      {(type === "fixed" || type === "hourly") && (
        <Section title="Progress" level={3} id="pf-progress">
          <Field className="max-w-48" label="Percent complete" htmlFor="pf-pct" optional error={errors.progress?.message}
            hint={msCount > 0 ? "With milestones, progress follows approved milestones instead." : "Shown on the project and your dashboard."}>
            <InputAffix suffix="%"><Input id="pf-pct" inputMode="numeric" className="num" placeholder="0" aria-invalid={!!errors.progress} aria-describedby={describedBy("pf-pct", errors.progress?.message, true)} {...register("progress")} /></InputAffix>
          </Field>
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>{project ? "Save changes" : "Create project"}</Button>
        <Button variant="ghost" onClick={() => (isDirty && !saved ? setDiscard(true) : router.push(back))}>Cancel</Button>
      </div>
      <DiscardDialog open={discard} onOpenChange={setDiscard} onDiscard={() => router.push(back)} />
    </form>
  );
}

"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { DiscardDialog, describedBy, useUnsavedChanges } from "@/components/clients/form-parts";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Section } from "@/components/ui/section";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { projectToCreate, projectToInput, projectToUpdate } from "@/lib/api/mappers/projects";
import { useClientOptions } from "@/lib/hooks/clients";
import { useCreateProject, useUpdateProject } from "@/lib/hooks/projects";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useBusiness } from "@/lib/hooks/profile";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { CURRENCIES, type BillingType, type Project } from "@/lib/types";
import { BillingFields } from "./billing-fields";
import { STATUS_LABEL } from "./logic";
import { emptyProjectForm, formToProject, PROJECT_FIELD_ALIASES, PROJECT_STATUSES, projectResolver, projectToForm, type ProjectFormValues } from "./schema";

const TYPES: { value: BillingType; title: string; desc: string }[] = [
  { value: "fixed", title: "Fixed price", desc: "One agreed price, invoiced in full or in stages." },
  { value: "hourly", title: "Hourly", desc: "Tracked time multiplied by your rate." },
  { value: "retainer", title: "Retainer", desc: "A recurring amount for each month or quarter." },
  { value: "milestone", title: "Milestones", desc: "Staged delivery. Each milestone has its own amount and approval." },
];
const grid = "grid gap-5 @2xl:grid-cols-2";

export function ProjectForm({ project, clientId }: { project?: Project; clientId?: string }) {
  const router = useRouter();
  const toast = useApiToast();
  const { clients } = useClientOptions();
  const base = useBusiness().defaultCurrency;
  const online = useAppStore((s) => s.online);
  const create = useCreateProject();
  const update = useUpdateProject(project?.id ?? "");
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: projectResolver,
    defaultValues: project ? projectToForm(project) : emptyProjectForm(clients, base, clientId),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setValue, formState: { errors, isDirty, isSubmitting, submitCount } } = form;
  const type = useWatch({ control, name: "billingType" });
  const currency = useWatch({ control, name: "currency" });
  useUnsavedChanges(isDirty && !saved);

  const back = project ? `/projects/${project.id}` : "/projects";
  const errorCount = Object.keys(errors).length;
  const rootError = errors.root?.message;

  const onSubmit = async (values: ProjectFormValues) => {
    if (!online) return toast.error(null, "You’re offline. Reconnect to save this project.");
    const input = formToProject(values);
    try {
      if (project) {
        const changes = projectToUpdate(input, projectToInput(project));
        if (Object.keys(changes).length > 0) await update.mutateAsync(changes);
        setSaved(true);
        toast.success(`${input.name} saved`);
        router.push(back);
      } else {
        const created = await create.mutateAsync(projectToCreate(input));
        setSaved(true);
        toast.success(`${input.name} created`);
        router.push(`/projects/${created.id}`);
      }
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 404) toast.error(e, "This project or its client no longer exists.");
      else if (!applyApiFieldErrors(form, e, PROJECT_FIELD_ALIASES)) toast.error(e, "Couldn’t save this project.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-11">
      {submitCount > 0 && (errorCount > 0 || rootError) && (
        <Notice tone="error" role="alert">{rootError ?? (errorCount === 1 ? "One field needs attention before you can save." : `${errorCount} fields need attention before you can save.`)}</Notice>
      )}
      {!online && <Notice tone="warn">You’re offline. Reconnect to save this project.</Notice>}

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
          <Field label="Status" htmlFor="pf-status">
            <FormSelect id="pf-status" control={control} name="status" options={PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          </Field>
          <Field label="Due date" htmlFor="pf-due" optional error={errors.dueDate?.message}>
            <Input id="pf-due" type="date" className="num" {...register("dueDate")} />
          </Field>
          <Field className="@2xl:col-span-2" label="Scope and notes" htmlFor="pf-notes" optional error={errors.description?.message}>
            <Textarea id="pf-notes" placeholder="What’s included, and what isn’t." {...register("description")} />
          </Field>
        </div>
      </Section>

      <Section title="How you bill" level={3} id="pf-billing">
        <Controller
          control={control}
          name="billingType"
          render={({ field }) => (
            <RadioGroup aria-label="Billing type" value={field.value} className="border-t border-border" onValueChange={field.onChange}>
              {TYPES.map((t) => (
                <ChoiceRow key={t.value}>
                  <RadioItem value={t.value} />
                  <span><span className="block font-medium">{t.title}</span><span className="t-caption">{t.desc}</span></span>
                </ChoiceRow>
              ))}
            </RadioGroup>
          )}
        />
        <BillingFields type={type} currency={currency} control={control} register={register} errors={errors} />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>{project ? "Save changes" : "Create project"}</Button>
        <Button variant="ghost" onClick={() => (isDirty && !saved ? setDiscard(true) : router.push(back))}>Cancel</Button>
      </div>
      <DiscardDialog open={discard} onOpenChange={setDiscard} onDiscard={() => router.push(back)} />
    </form>
  );
}

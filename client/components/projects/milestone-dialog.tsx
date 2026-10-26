"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describedBy } from "@/components/clients/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, InputAffix } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { milestoneToCreate, milestoneToInput, milestoneToUpdate } from "@/lib/api/mappers/milestones";
import { useCreateMilestone, useUpdateMilestone } from "@/lib/hooks/milestones";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { Milestone, Project } from "@/lib/types";
import { emptyMilestoneForm, formToMilestone, MILESTONE_FIELD_ALIASES, milestoneSchema, milestoneToForm, type MilestoneFormValues } from "./milestone-schema";

interface Props {
  project: Project;
  /** The milestone being edited; undefined adds a new one. */
  milestone?: Milestone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add or edit one milestone. The server owns the rules: a 422 is shown on its field, or on the form when it has none. */
export function MilestoneDialog({ project, milestone, open, onOpenChange }: Props) {
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const create = useCreateMilestone(project.id);
  const update = useUpdateMilestone(project.id);
  const values = () => (milestone ? milestoneToForm(milestone, project.currency) : emptyMilestoneForm());

  const form = useForm<MilestoneFormValues>({ resolver: zodResolver(milestoneSchema), defaultValues: values(), mode: "onTouched" });
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = form;
  // A fresh form every time the dialog opens (for the same or another milestone).
  useEffect(() => { if (open) reset(values()); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  const onSubmit = async (v: MilestoneFormValues) => {
    if (!online) return form.setError("root", { type: "server", message: "You’re offline. Reconnect to save this milestone." });
    const input = formToMilestone(v);
    try {
      if (milestone) {
        const changes = milestoneToUpdate(input, milestoneToInput(milestone), project.currency);
        if (Object.keys(changes).length > 0) await update.mutateAsync({ id: milestone.id, body: changes });
        toast.success(`${input.title} saved`);
      } else {
        await create.mutateAsync(milestoneToCreate(project.id, input, project.currency));
        toast.success(`${input.title} added`);
      }
      onOpenChange(false);
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 422 && applyApiFieldErrors(form, e, MILESTONE_FIELD_ALIASES)) return;
      if (status === 404) {
        toast.error(e, "This milestone or project no longer exists.");
        onOpenChange(false);
        return;
      }
      toast.error(e, "Couldn’t save this milestone.");
    }
  };

  const rootError = errors.root?.message;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent>
        <DialogTitle>{milestone ? "Edit milestone" : "Add a milestone"}</DialogTitle>
        <DialogDescription>
          {milestone ? "Changes apply to this milestone only." : "Added at the end of the list. Reorder it afterwards."}
        </DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          {rootError && <Notice tone="error" role="alert">{rootError}</Notice>}
          <Field label="Name" htmlFor="ms-title" error={errors.title?.message}>
            <Input id="ms-title" placeholder="Design approved" aria-invalid={!!errors.title} aria-describedby={describedBy("ms-title", errors.title?.message, false)} {...register("title")} />
          </Field>
          <Field label="Description" htmlFor="ms-desc" optional error={errors.description?.message}>
            <Textarea id="ms-desc" placeholder="What the client gets." {...register("description")} />
          </Field>
          <div className="grid gap-5 @2xl:grid-cols-2">
            <Field label="Amount" htmlFor="ms-amount" optional error={errors.amount?.message} hint="The money this milestone bills for.">
              <InputAffix prefix={project.currency}>
                <Input id="ms-amount" inputMode="decimal" className="num" placeholder="1,200.00" aria-invalid={!!errors.amount} aria-describedby={describedBy("ms-amount", errors.amount?.message, true)} {...register("amount")} />
              </InputAffix>
            </Field>
            <Field label="Due date" htmlFor="ms-due" optional error={errors.dueDate?.message}>
              <Input id="ms-due" type="date" className="num" {...register("dueDate")} />
            </Field>
          </div>
          <Controller
            control={control}
            name="approvalRequired"
            render={({ field }) => <Switch label="Client approval required" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{milestone ? "Save milestone" : "Add milestone"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

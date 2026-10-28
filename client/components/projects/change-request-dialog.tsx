"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describedBy } from "@/components/clients/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, InputAffix } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { changeRequestToCreate, changeRequestToInput, changeRequestToUpdate } from "@/lib/api/mappers/change-requests";
import { useCreateChangeRequest, useUpdateChangeRequest } from "@/lib/hooks/change-requests";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import type { ChangeRequest, Project } from "@/lib/types";
import {
  CHANGE_REQUEST_FIELD_ALIASES, changeRequestSchema, changeRequestToForm, emptyChangeRequestForm, formToChangeRequestInput,
  type ChangeRequestFormValues,
} from "./change-request-schema";

interface Props {
  project: Project;
  /** The scope change being edited; undefined logs a new one. */
  changeRequest?: ChangeRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Log or edit one scope change. The server owns the rules: a 422 lands on its field; a 409 means it was already decided. */
export function ChangeRequestDialog({ project, changeRequest, open, onOpenChange }: Props) {
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const create = useCreateChangeRequest();
  const update = useUpdateChangeRequest();
  const values = () => (changeRequest ? changeRequestToForm(changeRequest, project.currency) : emptyChangeRequestForm());

  const form = useForm<ChangeRequestFormValues>({ resolver: zodResolver(changeRequestSchema), defaultValues: values(), mode: "onTouched" });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;
  useEffect(() => { if (open) reset(values()); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, changeRequest?.id]);

  const onSubmit = async (v: ChangeRequestFormValues) => {
    if (!online) return form.setError("root", { type: "server", message: "You’re offline. Reconnect to save this scope change." });
    const input = formToChangeRequestInput(v);
    try {
      if (changeRequest) {
        const changes = changeRequestToUpdate(input, changeRequestToInput(changeRequest), project.currency);
        if (Object.keys(changes).length > 0) await update.mutateAsync({ id: changeRequest.id, body: changes });
        toast.success(`${input.title} saved`);
      } else {
        await create.mutateAsync(changeRequestToCreate(project.id, input, project.currency));
        toast.success(`${input.title} logged`);
      }
      onOpenChange(false);
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 422 && applyApiFieldErrors(form, e, CHANGE_REQUEST_FIELD_ALIASES)) return;
      if (status === 404) {
        toast.error(e, "This scope change or project no longer exists.");
        onOpenChange(false);
        return;
      }
      if (status === 409) return form.setError("root", { type: "server", message: getApiErrorMessage(e) });
      toast.error(e, "Couldn’t save this scope change.");
    }
  };

  const rootError = errors.root?.message;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent>
        <DialogTitle>{changeRequest ? "Edit scope change" : "Log a scope change"}</DialogTitle>
        <DialogDescription>
          {changeRequest ? "Only a pending scope change can be edited." : "Work the client asked for beyond the agreed scope. Decide on it afterwards."}
        </DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          {rootError && <Notice tone="error" role="alert">{rootError}</Notice>}
          <Field label="Title" htmlFor="cr-title" error={errors.title?.message}>
            <Input id="cr-title" placeholder="Add a pricing page" aria-invalid={!!errors.title} aria-describedby={describedBy("cr-title", errors.title?.message, false)} {...register("title")} />
          </Field>
          <Field label="Description" htmlFor="cr-desc" optional error={errors.description?.message}>
            <Textarea id="cr-desc" placeholder="What changes, and why." {...register("description")} />
          </Field>
          <div className="grid gap-5 @2xl:grid-cols-2">
            <Field label="Estimated hours" htmlFor="cr-hours" optional error={errors.estimatedHours?.message}>
              <Input id="cr-hours" inputMode="decimal" className="num" placeholder="6" aria-invalid={!!errors.estimatedHours} aria-describedby={describedBy("cr-hours", errors.estimatedHours?.message, false)} {...register("estimatedHours")} />
            </Field>
            <Field label="Estimated amount" htmlFor="cr-amount" optional error={errors.estimatedAmount?.message} hint="Leave blank while unpriced.">
              <InputAffix prefix={project.currency}>
                <Input id="cr-amount" inputMode="decimal" className="num" placeholder="600.00" aria-invalid={!!errors.estimatedAmount} aria-describedby={describedBy("cr-amount", errors.estimatedAmount?.message, true)} {...register("estimatedAmount")} />
              </InputAffix>
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{changeRequest ? "Save scope change" : "Log scope change"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

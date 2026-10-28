"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, ChoiceRow } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, InputAffix } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { FormSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { toInvoiceUpdate } from "@/lib/api/mappers/invoices";
import { useDeleteInvoice, useUpdateInvoice } from "@/lib/hooks/invoices";
import { usePaymentMethods } from "@/lib/hooks/payment-methods";
import { methodTitle } from "@/lib/payment-methods";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import type { InvoiceDetail } from "@/lib/types";
import { draftChanges, draftDefaults } from "./draft";
import { editDraftSchema, type EditDraftValues } from "./schemas";

const TAX_OPTIONS = [
  { value: "keep", label: "Keep the current taxes" },
  { value: "none", label: "Remove all taxes" },
  { value: "custom", label: "Replace with one tax" },
];

interface EditProps {
  invoice: InvoiceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offline: boolean;
  /** Opens the delete-and-recreate confirmation (line items can't be edited on a draft). */
  onRecreate: () => void;
}

/**
 * Edit the header fields a draft allows (dates, tax, discount, notes, payment note and methods). Only changed
 * fields are sent and the server's recomputed totals replace the cached invoice. The lines, time, milestones and project are fixed.
 */
export function EditDraftDialog({ invoice, open, onOpenChange, offline, onRecreate }: EditProps) {
  const update = useUpdateInvoice();
  const methodsQuery = usePaymentMethods();
  const methods = useMemo(() => (methodsQuery.data ?? []).filter((m) => m.enabled), [methodsQuery.data]);
  const form = useForm<EditDraftValues>({ resolver: zodResolver(editDraftSchema), defaultValues: draftDefaults(invoice) });
  const { register, control, handleSubmit, setValue, reset, formState: { errors } } = form;
  const taxMode = useWatch({ control, name: "taxMode" });
  const changeMethods = useWatch({ control, name: "changeMethods" });
  const methodIds = useWatch({ control, name: "methodIds" });

  const close = () => { onOpenChange(false); reset(draftDefaults(invoice)); update.reset(); };

  const submit = handleSubmit(async (values) => {
    const changes = draftChanges(values, invoice);
    if (Object.keys(changes).length === 0) { close(); return; }
    try {
      await update.mutateAsync({ id: invoice.id, body: toInvoiceUpdate(changes) });
      toast.success("Draft updated", { description: "Totals were recalculated." });
      onOpenChange(false);
    } catch (e) {
      applyApiFieldErrors(form, e, { taxes: "taxName" });
    }
  });

  const serverError = errors.root?.message ?? (update.isError && getApiErrorStatus(update.error) !== 422 ? getApiErrorMessage(update.error, "Couldn’t save the changes.") : undefined);
  const toggleMethod = (id: string) => setValue("methodIds", methodIds.includes(id) ? methodIds.filter((x) => x !== id) : [...methodIds, id], { shouldDirty: true });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <DialogTitle>Edit draft {invoice.number}</DialogTitle>
        <DialogDescription>Change the dates, tax, discount, notes and payment methods.</DialogDescription>
        <Notice>
          <span>
            Line items, time entries, milestones and the project can’t be edited on a draft.{" "}
            <button type="button" className="font-medium underline underline-offset-[3px]" onClick={onRecreate}>Delete the draft and recreate it</button>
            {" "}to change those.
          </span>
        </Notice>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issue date" htmlFor="ed-issue" error={errors.issueDate?.message}><Input id="ed-issue" type="date" aria-invalid={Boolean(errors.issueDate)} {...register("issueDate")} /></Field>
            <Field label="Due date" htmlFor="ed-due" error={errors.dueDate?.message}><Input id="ed-due" type="date" aria-invalid={Boolean(errors.dueDate)} {...register("dueDate")} /></Field>
            <Field label="Discount" htmlFor="ed-disc" error={errors.discountRate?.message}>
              <InputAffix suffix="%"><Input id="ed-disc" inputMode="decimal" aria-invalid={Boolean(errors.discountRate)} {...register("discountRate")} /></InputAffix>
            </Field>
            <Field label="Tax" htmlFor="ed-taxmode"><FormSelect id="ed-taxmode" control={control} name="taxMode" options={TAX_OPTIONS} /></Field>
          </div>
          {taxMode === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tax name" htmlFor="ed-taxname" error={errors.taxName?.message}><Input id="ed-taxname" placeholder="VAT" aria-invalid={Boolean(errors.taxName)} {...register("taxName")} /></Field>
              <Field label="Tax rate" htmlFor="ed-taxrate" error={errors.taxRate?.message}>
                <InputAffix suffix="%"><Input id="ed-taxrate" inputMode="decimal" aria-invalid={Boolean(errors.taxRate)} {...register("taxRate")} /></InputAffix>
              </Field>
            </div>
          )}
          <Field label="Tax note" htmlFor="ed-taxnote" optional hint="Printed when no tax applies (exempt, reverse charge…)." error={errors.taxNote?.message}><Input id="ed-taxnote" {...register("taxNote")} /></Field>
          <Field label="Payment note" htmlFor="ed-instr" optional error={errors.paymentInstructions?.message}><Textarea id="ed-instr" {...register("paymentInstructions")} /></Field>
          <Field label="Notes" htmlFor="ed-notes" optional error={errors.notes?.message}><Textarea id="ed-notes" {...register("notes")} /></Field>

          <div className="flex flex-col gap-2">
            <Controller
              control={control} name="changeMethods"
              render={({ field }) => (
                <ChoiceRow>
                  <Checkbox id="ed-change" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                  <label htmlFor="ed-change" className="min-w-0 flex-1">
                    <span className="font-medium">Change the payment methods</span><br />
                    <span className="t-caption">Currently {invoice.methods.length === 0 ? "none" : invoice.methods.map((m) => m.label).join(", ")}. Choosing methods replaces them.</span>
                  </label>
                </ChoiceRow>
              )}
            />
            {changeMethods && (
              <div role="group" aria-label="Payment methods">
                {methods.length === 0 && <p className="t-caption">No payment methods are enabled. The invoice will show none.</p>}
                {methods.map((m) => (
                  <ChoiceRow key={m.id}>
                    <Checkbox checked={methodIds.includes(m.id)} onCheckedChange={() => toggleMethod(m.id)} aria-label={methodTitle(m)} className="mt-0.5" />
                    <span className="min-w-0 flex-1 font-medium">{methodTitle(m)}</span>
                  </ChoiceRow>
                ))}
              </div>
            )}
          </div>

          {serverError && <Notice tone="error" role="alert">{serverError}</Notice>}
          {offline && <p className="text-sm text-muted-foreground">You’re offline. Saving needs a connection.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={offline} loading={update.isPending}>Save changes</Button>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteProps {
  invoice: InvoiceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offline: boolean;
  /** After deleting, open the create flow for the same project instead of going back to the list. */
  recreate?: boolean;
}

/** Confirms deleting a draft. Its time entries, milestones and retainer period are freed. */
export function DeleteDraftDialog({ invoice, open, onOpenChange, offline, recreate = false }: DeleteProps) {
  const router = useRouter();
  const remove = useDeleteInvoice();

  const close = () => { onOpenChange(false); remove.reset(); };
  const confirm = async () => {
    try {
      await remove.mutateAsync(invoice.id);
    } catch { return; /* shown inline */ }
    toast.success(`Draft ${invoice.number} deleted`, { description: recreate ? "Set it up again with the changes you need." : undefined });
    onOpenChange(false);
    if (recreate) {
      const q = new URLSearchParams({ projectId: invoice.projectId });
      if (invoice.retainerPeriodStart) q.set("period", invoice.retainerPeriodStart);
      router.push(`/invoices/new?${q.toString()}`);
    } else {
      router.push("/invoices");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogTitle>{recreate ? `Delete ${invoice.number} and recreate it?` : `Delete draft ${invoice.number}?`}</DialogTitle>
        <DialogDescription>
          {recreate
            ? "The draft is deleted and you start a new one for the same project. Its time, milestones and retainer period become available again. A draft’s line items can’t be edited, which is why it has to be recreated."
            : "The draft is deleted for good. Its time entries, milestones and retainer period become available to invoice again."}
        </DialogDescription>
        {remove.isError && <Notice tone="error" role="alert">{getApiErrorMessage(remove.error, "Couldn’t delete the draft.")}</Notice>}
        {offline && <p className="text-sm text-muted-foreground">You’re offline. Deleting needs a connection.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={offline} loading={remove.isPending} onClick={() => void confirm()}>{recreate ? "Delete and recreate" : "Delete draft"}</Button>
          <DialogClose asChild><Button variant="ghost">Keep draft</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

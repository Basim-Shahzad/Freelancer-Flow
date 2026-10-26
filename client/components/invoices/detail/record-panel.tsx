"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { PAYMENT_METHOD_LABEL, preferredPaymentMethod, RECORDABLE_METHODS, toPaymentCreate } from "@/lib/api/mappers/invoices";
import { todayISO } from "@/lib/dates";
import { useRecordPayment } from "@/lib/hooks/invoices";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatAmount, formatMoney, parseAmount } from "@/lib/money";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import type { InvoiceDetail } from "@/lib/types";
import { recordSchema, type RecordValues } from "./schemas";

interface Props { invoice: InvoiceDetail; onClose: () => void }

const OPTIONS = RECORDABLE_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }));

/** Record a payment received outside Paylancr. Amount defaults to the balance and can't exceed it. */
export function RecordPanel({ invoice, onClose }: Props) {
  const toast = useApiToast();
  const record = useRecordPayment();
  const ref = useRef<HTMLElement>(null);
  const balance = invoice.balanceDue;
  const today = todayISO();

  const form = useForm<RecordValues>({
    resolver: zodResolver(recordSchema(balance)),
    defaultValues: { amount: formatAmount(balance, invoice.currency), date: today, method: preferredPaymentMethod(invoice.methods), reference: "" },
  });
  const { register, control, handleSubmit, formState: { errors } } = form;
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = handleSubmit(async (v) => {
    const amount = parseAmount(v.amount) ?? 0;
    try {
      await record.mutateAsync({
        id: invoice.id,
        body: toPaymentCreate({ amount, date: v.date, method: v.method as (typeof RECORDABLE_METHODS)[number], reference: v.reference }, invoice.currency, today),
      });
      toast.success(`Payment recorded · ${formatMoney(amount, invoice.currency)}`);
      onClose();
    } catch (e) {
      applyApiFieldErrors(form, e, { paidAt: "date" });
    }
  });

  const serverError = errors.root?.message ?? (record.isError && getApiErrorStatus(record.error) !== 422 ? getApiErrorMessage(record.error, "Couldn’t record the payment.") : undefined);

  return (
    <section ref={ref} tabIndex={-1} id="panel-record" aria-labelledby="id-rec" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-rec" className="t-h3">Record a payment</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <Field label="Amount received" htmlFor="rp-a" error={errors.amount?.message}>
            <InputAffix prefix={invoice.currency}><Input id="rp-a" inputMode="decimal" aria-invalid={Boolean(errors.amount)} {...register("amount")} /></InputAffix>
          </Field>
          <Field label="Date" htmlFor="rp-d" error={errors.date?.message}><Input id="rp-d" type="date" max={today} aria-invalid={Boolean(errors.date)} {...register("date")} /></Field>
          <Field label="Method" htmlFor="rp-m" error={errors.method?.message}>
            <FormSelect id="rp-m" control={control} name="method" options={OPTIONS} />
          </Field>
          <Field label="Reference" htmlFor="rp-r" optional error={errors.reference?.message} hint="A transaction ID only. No card numbers, IBANs or ID numbers."><Input id="rp-r" placeholder="Transaction ID" {...register("reference")} /></Field>
        </div>
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <Notice>If your client withheld tax, the invoice already shows it; record what actually reached you, up to the balance.</Notice>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={record.isPending}>Save payment</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}

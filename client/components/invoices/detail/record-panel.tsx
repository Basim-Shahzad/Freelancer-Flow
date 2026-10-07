"use client";

import { Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, InputAffix } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Field, Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { todayISO } from "@/lib/dates";
import { formatAmount, formatMoney, parseAmount } from "@/lib/money";
import { methodTitle } from "@/lib/payment-methods";
import { useAppStore } from "@/lib/store";
import type { Invoice, PaymentMethod } from "@/lib/types";
import { recordSchema, type RecordValues } from "./schemas";

interface Props { invoice: Invoice; balance: number; methods: PaymentMethod[]; onClose: () => void }

/** Record a payment received outside Paylancr. Amount defaults to the balance and can't exceed it. */
export function RecordPanel({ invoice, balance, methods, onClose }: Props) {
  const recordPayment = useAppStore((s) => s.recordPayment);
  const ref = useRef<HTMLElement>(null);
  const [fileName, setFileName] = useState<string>();
  const options = [...new Set([...methods.map((m) => methodTitle(m)), "Other"])];
  const preferred = methods.find((m) => invoice.paymentMethodIds[0] === m.id);

  const { register, control, handleSubmit, formState: { errors } } = useForm<RecordValues>({
    resolver: zodResolver(recordSchema(balance)),
    defaultValues: { amount: formatAmount(balance, invoice.currency), date: todayISO(), method: preferred ? methodTitle(preferred) : (options[0] ?? "Other"), reference: "" },
  });
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = handleSubmit((v) => {
    const amount = parseAmount(v.amount) ?? 0;
    recordPayment(invoice.id, { amount, date: v.date, method: v.method, reference: v.reference, attachmentName: fileName });
    toast.success(`Payment recorded · ${formatMoney(amount, invoice.currency)}`);
    onClose();
  });

  return (
    <section ref={ref} tabIndex={-1} id="panel-record" aria-labelledby="id-rec" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-rec" className="t-h3">Record a payment</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <Field label="Amount received" htmlFor="rp-a" error={errors.amount?.message}>
            <InputAffix prefix={invoice.currency}><Input id="rp-a" inputMode="decimal" aria-invalid={Boolean(errors.amount)} {...register("amount")} /></InputAffix>
          </Field>
          <Field label="Date" htmlFor="rp-d" error={errors.date?.message}><Input id="rp-d" type="date" aria-invalid={Boolean(errors.date)} {...register("date")} /></Field>
          <Field label="Method" htmlFor="rp-m" error={errors.method?.message}>
            <FormSelect id="rp-m" control={control} name="method" options={options.map((o) => ({ value: o, label: o }))} />
          </Field>
          <Field label="Reference" htmlFor="rp-r" optional error={errors.reference?.message}><Input id="rp-r" placeholder="Transaction ID" {...register("reference")} /></Field>
          <div className="flex flex-col gap-2 @2xl:col-span-2">
            <span className="text-sm font-semibold">Attachment <span className="font-normal text-muted-foreground">(optional)</span></span>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-rule px-3 text-xs font-semibold hover:bg-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
                <Paperclip className="size-4" aria-hidden="true" />{fileName ? "Change file" : "Attach receipt"}
                <Input type="file" accept="application/pdf,image/*" className="sr-only min-h-0" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
              </Label>
              {fileName && <span className="text-sm">{fileName}</span>}
            </div>
            <span className="text-xs text-muted-foreground">PDF or image, up to 10 MB. Only the file name is kept in this demo.</span>
          </div>
        </div>
        <Notice>If your client withheld tax, record the full invoice amount and note the withholding. Withholding is recorded at receipt, not on the invoice.</Notice>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save payment</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}

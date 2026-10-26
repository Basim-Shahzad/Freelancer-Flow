"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useCancelInvoice, useReverseWriteOff, useWriteOffInvoice } from "@/lib/hooks/invoices";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatMoney } from "@/lib/money";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { InvoiceDetail } from "@/lib/types";
import { writeOffSchema } from "./schemas";

type Kind = "writeoff" | "reverse" | "cancel";

interface Props { kind: Kind; invoice: InvoiceDetail; onClose: () => void }

/** Inline confirmation for write off (needs a reason) / reverse write-off / cancel. A 409 shows the server's message. */
export function ConfirmPanel({ kind, invoice, onClose }: Props) {
  const toast = useApiToast();
  const writeOff = useWriteOffInvoice();
  const reverse = useReverseWriteOff();
  const cancel = useCancelInvoice();
  const ref = useRef<HTMLElement>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  useEffect(() => { ref.current?.focus(); }, []);

  const copy = {
    cancel: { title: "Cancel this invoice?", body: `It stays in your records as cancelled and can’t be paid or edited, and the number ${invoice.number} is not reused. Your client’s link stops working and any time on it becomes billable again. An invoice with payments can’t be cancelled: void the payments first.`, cta: "Cancel invoice", destructive: true },
    writeoff: { title: "Write off the balance?", body: "Use this when you don’t expect to be paid. The invoice moves to written off and stops counting as outstanding. Payments you recorded stay. You can reverse it later.", cta: `Write off ${formatMoney(invoice.balanceDue, invoice.currency)}`, destructive: false },
    reverse: { title: "Reverse the write-off?", body: "The invoice returns to sent, partially paid or paid, based on its payments, and counts as outstanding again.", cta: "Reverse write-off", destructive: false },
  }[kind];

  const mutation = kind === "cancel" ? cancel : kind === "writeoff" ? writeOff : reverse;

  const confirm = async () => {
    try {
      if (kind === "cancel") {
        await cancel.mutateAsync(invoice.id);
        toast.success(`${invoice.number} cancelled`);
      } else if (kind === "writeoff") {
        const parsed = writeOffSchema.safeParse({ reason });
        if (!parsed.success) { setReasonError(parsed.error.issues[0]?.message); return; }
        setReasonError(undefined);
        await writeOff.mutateAsync({ id: invoice.id, reason: parsed.data.reason });
        toast.success(`${invoice.number} written off`);
      } else {
        await reverse.mutateAsync(invoice.id);
        toast.success("Write-off reversed");
      }
      onClose();
    } catch { /* shown inline from mutation.error */ }
  };

  return (
    <section ref={ref} tabIndex={-1} id={`panel-${kind}`} role="group" aria-labelledby="id-cf" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-cf" className="t-h3">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      {kind === "writeoff" && (
        <Field label="Reason (kept in the activity log)" htmlFor="id-cr" error={reasonError}>
          <Input id="id-cr" value={reason} maxLength={500} aria-invalid={Boolean(reasonError)} onChange={(e) => setReason(e.target.value)} placeholder="Why won’t this be paid?" />
        </Field>
      )}
      {mutation.isError && <Notice tone="error">{getApiErrorMessage(mutation.error, "That didn’t work. Try again.")}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant={copy.destructive ? "destructive" : "primary"} loading={mutation.isPending} onClick={() => void confirm()}>{copy.cta}</Button>
        <Button variant="ghost" onClick={onClose}>Keep as is</Button>
      </div>
    </section>
  );
}

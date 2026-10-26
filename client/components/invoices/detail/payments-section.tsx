"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { CardBody, CardHead } from "@/components/ui/section";
import { PAYMENT_METHOD_LABEL } from "@/lib/api/mappers/invoices";
import { fmtDate } from "@/lib/dates";
import { useVoidPayment } from "@/lib/hooks/invoices";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { formatMoney } from "@/lib/money";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { InvoiceDetail, InvoicePayment } from "@/lib/types";

interface Props { invoice: InvoiceDetail; canVoid: boolean; offline: boolean }

/** Payments recorded against the invoice, each of which can be voided (a mistake) with a confirm dialog. */
export function PaymentsSection({ invoice, canVoid, offline }: Props) {
  const toast = useApiToast();
  const voidPayment = useVoidPayment();
  const [target, setTarget] = useState<InvoicePayment | null>(null);

  const close = () => { setTarget(null); voidPayment.reset(); };
  const confirm = async () => {
    if (!target) return;
    try {
      await voidPayment.mutateAsync({ id: invoice.id, paymentId: target.id });
      toast.success(`Payment of ${formatMoney(target.amount, invoice.currency)} voided`);
      close();
    } catch { /* shown inline from voidPayment.error */ }
  };

  if (invoice.payments.length === 0) return null;
  return (
    <section aria-labelledby="id-pay">
      <CardHead title={<span id="id-pay">Payments</span>} level={3} className="border-t" />
      <CardBody>
        <ul className="m-0 flex list-none flex-col p-0">
          {invoice.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border py-3 first:pt-0 last:border-b-0">
              <div className="min-w-0">
                <div className="num font-semibold">{formatMoney(p.amount, invoice.currency)}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                {p.reference && <span className="break-all">Ref {p.reference}</span>}
                {canVoid && (
                  <Button variant="link" disabled={offline} onClick={() => setTarget(p)} className="min-h-9 text-xs text-error-ink">
                    Void<span className="sr-only"> payment of {formatMoney(p.amount, invoice.currency)}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>

      <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogTitle>Void this payment?</DialogTitle>
          <DialogDescription>
            {target ? `${formatMoney(target.amount, invoice.currency)} received ${fmtDate(target.paidAt)}` : ""} will be removed and the balance and status will update. Use this if you recorded it by mistake.
          </DialogDescription>
          {voidPayment.isError && <Notice tone="error">{getApiErrorMessage(voidPayment.error, "Couldn’t void this payment.")}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" loading={voidPayment.isPending} disabled={offline} onClick={() => void confirm()}>Void payment</Button>
            <DialogClose asChild><Button variant="ghost">Keep it</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

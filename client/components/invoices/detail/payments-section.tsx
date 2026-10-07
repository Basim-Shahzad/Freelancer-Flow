"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CardBody, CardHead } from "@/components/ui/section";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { Invoice, Payment } from "@/lib/types";

interface Props { invoice: Invoice; canReverse: boolean; offline: boolean }

export function PaymentsSection({ invoice, canReverse, offline }: Props) {
  const reversePayment = useAppStore((s) => s.reversePayment);
  const [target, setTarget] = useState<Payment | null>(null);

  const reverse = () => {
    if (!target) return;
    reversePayment(invoice.id, target.id);
    toast.success("Payment reversed", { description: `${formatMoney(target.amount, invoice.currency)} removed from ${invoice.number}` });
    setTarget(null);
  };

  if (invoice.payments.length === 0) return null;
  return (
    <section aria-labelledby="id-pay">
      <CardHead title={<span id="id-pay">Payments</span>} level={3} className="border-t" />
      <CardBody>
      <ul className="m-0 flex list-none flex-col p-0">
        {invoice.payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0 first:pt-0">
            <div className="min-w-0">
              <div className="num font-semibold">{formatMoney(p.amount, invoice.currency)}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(p.date)} · {p.method}</div>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
              {p.reference && <span>Ref {p.reference}</span>}
              {canReverse && (
                <Button variant="link" disabled={offline} onClick={() => setTarget(p)} className="min-h-9 text-xs text-error-ink">
                  Reverse<span className="sr-only"> payment of {formatMoney(p.amount, invoice.currency)}</span>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      </CardBody>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogTitle>Reverse this payment?</DialogTitle>
          <DialogDescription>
            {target ? `${formatMoney(target.amount, invoice.currency)} received ${fmtDate(target.date)}` : ""} will be removed and the balance and status will update. Use this if you recorded it by mistake.
          </DialogDescription>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={reverse}>Reverse payment</Button>
            <DialogClose asChild><Button variant="ghost">Keep it</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

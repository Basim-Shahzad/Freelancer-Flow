"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { Invoice } from "@/lib/types";

type Kind = "writeoff" | "reverse" | "void";

interface Props { kind: Kind; invoice: Invoice; balance: number; onClose: () => void }

/** Inline confirmation for write off / reverse write-off / void. Reason is kept in the activity log. */
export function ConfirmPanel({ kind, invoice, balance, onClose }: Props) {
  const writeOff = useAppStore((s) => s.writeOff);
  const reverseWriteOff = useAppStore((s) => s.reverseWriteOff);
  const voidInvoice = useAppStore((s) => s.voidInvoice);
  const ref = useRef<HTMLElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { ref.current?.focus(); }, []);

  const copy = {
    void: { title: "Void this invoice?", body: `It stays in your records as void and can’t be paid or edited. The number ${invoice.number} is not reused. Your client’s share link will show it as cancelled.`, cta: "Void invoice", destructive: true },
    writeoff: { title: "Write off the balance?", body: "Use this when you don’t expect to be paid. The invoice moves to written off and stops counting as outstanding. You can reverse it later.", cta: `Write off ${formatMoney(balance, invoice.currency)}`, destructive: false },
    reverse: { title: "Reverse the write-off?", body: "The invoice returns to its previous status and counts as outstanding again.", cta: "Reverse write-off", destructive: false },
  }[kind];

  const confirm = () => {
    const r = reason.trim() || undefined;
    if (kind === "void") { voidInvoice(invoice.id, r); toast.success(`${invoice.number} voided`); }
    if (kind === "writeoff") { writeOff(invoice.id, r); toast.success(`${invoice.number} written off`); }
    if (kind === "reverse") { reverseWriteOff(invoice.id); toast.success("Write-off reversed"); }
    onClose();
  };

  return (
    <section ref={ref} tabIndex={-1} id={`panel-${kind}`} role="group" aria-labelledby="id-cf" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-cf" className="t-h3">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      {kind !== "reverse" && (
        <Field label="Reason (kept in the activity log)" htmlFor="id-cr" optional>
          <Input id="id-cr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={copy.destructive ? "destructive" : "primary"} onClick={confirm}>{copy.cta}</Button>
        <Button variant="ghost" onClick={onClose}>Keep as is</Button>
      </div>
    </section>
  );
}

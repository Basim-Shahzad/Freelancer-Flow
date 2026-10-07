"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { fmtDate } from "@/lib/dates";
import { daysOverdue } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";
import { useAppStore } from "@/lib/store";
import type { Client, Invoice, InvoiceStatus } from "@/lib/types";
import { reminderMessage, shareLink, whatsappUrl, type Tone } from "./messages";

type Channel = "email" | "whatsapp";

interface Props { invoice: Invoice; status: InvoiceStatus; balance: number; client?: Client; onClose: () => void }

export function RemindPanel({ invoice, status, balance, client, onClose }: Props) {
  const remind = useAppStore((s) => s.remindInvoice);
  const ownerName = useAppStore((s) => s.business.ownerName);
  const ref = useRef<HTMLElement>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<Tone>(status === "overdue" ? "firm" : "polite");

  const build = (t: Tone) => reminderMessage({
    tone: t, contactName: client?.contactName ?? "there", ownerName, number: invoice.number, amount: formatMoney(balance, invoice.currency),
    dueDate: fmtDate(invoice.dueDate), overdueDays: daysOverdue(invoice), link: shareLink(window.location.origin, invoice.shareToken),
  });
  const [message, setMessage] = useState(() => build(tone));
  useEffect(() => { ref.current?.focus(); }, []);

  const pickTone = (t: Tone) => { setTone(t); setMessage(build(t)); };

  const send = () => {
    remind(invoice.id, channel, tone);
    if (channel === "whatsapp") {
      window.open(whatsappUrl(client?.whatsapp, message), "_blank", "noopener,noreferrer");
      toast.success("Reminder opened in WhatsApp", { description: "Press send in WhatsApp to deliver it." });
    } else {
      toast.success("Reminder sent", { description: client?.email ? `Emailed to ${client.email}` : undefined });
    }
    onClose();
  };

  return (
    <section ref={ref} tabIndex={-1} id="panel-remind" aria-labelledby="id-rem" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-rem" className="t-h3">Remind {client?.contactName.split(" ")[0] ?? "your client"} about {invoice.number}</h2>
      <div className="flex flex-wrap gap-4">
        <Segmented<Channel> label="Channel" value={channel} onChange={setChannel} options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp message" }]} />
        <Segmented<Tone> label="Tone" value={tone} onChange={pickTone} options={[{ value: "polite", label: "Polite" }, { value: "firm", label: "Firm" }, { value: "final", label: "Final" }]} />
      </div>
      <Field
        label="Message" htmlFor="id-msg"
        hint={channel === "email" ? `Sent from Paylancr to ${client?.email ?? "your client"}. Replies go to you.` : "Opens WhatsApp with this text ready. You press send in WhatsApp; Paylancr can’t see the chat."}
      >
        <Textarea id="id-msg" rows={5} className="min-h-32" value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={send} disabled={!message.trim()}>{channel === "email" ? "Send email" : "Open WhatsApp with this message"}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { useRemindInvoice } from "@/lib/hooks/invoices";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import type { InvoiceDetail } from "@/lib/types";

type Channel = "email" | "whatsapp";

interface Props { invoice: InvoiceDetail; onClose: () => void }

/** What a failed reminder means: 429/409 are mostly "reminded recently"; any other 409 carries the server's reason. */
function reminderError(error: unknown): string {
  const status = getApiErrorStatus(error);
  if (status === 429) return "You reminded this client recently. Reminders can go out once every 24 hours; try again later.";
  if (status === 409) return `Reminded recently, or this invoice can’t be reminded right now. ${getApiErrorMessage(error)}`;
  return getApiErrorMessage(error, "Couldn’t send the reminder.");
}

/** Remind the client by email, or open a prepared WhatsApp message. The wording comes from the server. */
export function RemindPanel({ invoice, onClose }: Props) {
  const remind = useRemindInvoice();
  const ref = useRef<HTMLElement>(null);
  const [channel, setChannel] = useState<Channel>("email");
  useEffect(() => { ref.current?.focus(); }, []);

  const send = async () => {
    try {
      const res = await remind.mutateAsync({ id: invoice.id, channel });
      if (channel === "whatsapp") {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
        toast.success("Reminder opened in WhatsApp", { description: "Press send in WhatsApp to deliver it." });
      } else if (res.emailDelivered === false) {
        toast.error("The reminder email couldn’t be delivered", { description: "It’s recorded in the activity. Try WhatsApp instead." });
      } else {
        toast.success("Reminder sent", { description: `Emailed to ${invoice.client.name}` });
      }
      onClose();
    } catch { /* shown inline from remind.error */ }
  };

  return (
    <section ref={ref} tabIndex={-1} id="panel-remind" aria-labelledby="id-rem" className="flex flex-col gap-4 border-y border-rule py-4 outline-none print:hidden">
      <h2 id="id-rem" className="t-h3">Remind {invoice.client.name} about {invoice.number}</h2>
      <Segmented<Channel> label="Channel" value={channel} onChange={setChannel} options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp message" }]} />
      <p className="text-sm text-muted-foreground">
        {channel === "email"
          ? "Paylancr emails a reminder with the payment details. Replies go to you."
          : "Opens WhatsApp with the reminder ready. You press send in WhatsApp; Paylancr can’t see the chat."}{" "}
        One reminder can go out every 24 hours.
      </p>
      {remind.isError && <Notice tone="error">{reminderError(remind.error)}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void send()} loading={remind.isPending}>{channel === "email" ? "Send email" : "Open WhatsApp with the reminder"}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </section>
  );
}

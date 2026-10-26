"use client";

import { Check, Link2, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import type { ShareChannel } from "@/lib/api/invoices.types";
import { useSendInvoice, useShareLinks } from "@/lib/hooks/invoices";
import { useCopy } from "@/lib/hooks/use-copy";
import { getApiErrorMessage } from "@/lib/services/api.service";
import type { InvoiceDetail } from "@/lib/types";

interface Links {
  portalUrl: string;
  whatsappUrl: string;
}

interface Props { invoice: InvoiceDetail; open: boolean; onOpenChange: (open: boolean) => void; offline: boolean }

/**
 * Send (a draft) or share (an issued invoice) in one of three ways. Email sends the PDF from Paylancr; WhatsApp
 * opens a prepared message in a new tab (the app can't know it was sent); Copy link hands over the client page. Every
 * channel moves a draft to sent. Sending an issued invoice again changes nothing, so the issued flow only fetches
 * fresh links (use "Send a reminder" to chase the client). If the email can't be delivered the invoice is still sent
 * and the links stay on screen.
 */
export function SendDialog({ invoice, open, onOpenChange, offline }: Props) {
  const draft = invoice.status === "draft";
  const send = useSendInvoice();
  const share = useShareLinks();
  const { copied, copy } = useCopy();
  const [failedLinks, setFailedLinks] = useState<Links | null>(null);
  const busy = send.isPending || share.isPending;
  const error = send.error ?? share.error;

  const reset = () => { send.reset(); share.reset(); setFailedLinks(null); };
  const close = () => { onOpenChange(false); reset(); };

  const run = async (channel: ShareChannel) => {
    reset();
    try {
      const res = draft
        ? await send.mutateAsync({ id: invoice.id, channel })
        : await share.mutateAsync(invoice.id);
      if (channel === "whatsapp") {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
        toast.success("Opened in WhatsApp", { description: "Press send in WhatsApp to share it." });
        close();
      } else if (channel === "link") {
        await copy("link", res.portalUrl);
        toast.success("Link copied", { description: "Your client sees payment instructions only. There is no pay button." });
        close();
      } else if ("emailDelivered" in res && res.emailDelivered === false) {
        setFailedLinks({ portalUrl: res.portalUrl, whatsappUrl: res.whatsappUrl });
      } else {
        toast.success(`${invoice.number} sent`);
        close();
      }
    } catch { /* shown inline from the mutation error */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogTitle>{draft ? `Send ${invoice.number}` : `Share ${invoice.number}`}</DialogTitle>
        <DialogDescription>
          {draft
            ? `Choose how ${invoice.client.name} gets it. The invoice is marked as sent whichever you pick.`
            : "Get the client link again. Nothing is re-sent; to chase a payment, send a reminder instead."}
        </DialogDescription>

        {failedLinks && (
          <Notice tone="warn" role="alert">
            <span>
              <b>Marked as sent, but the email couldn’t be delivered.</b> It’s recorded in the activity. Share it yourself instead:
              <span className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { window.open(failedLinks.whatsappUrl, "_blank", "noopener,noreferrer"); }}><MessageCircle aria-hidden="true" />Open WhatsApp</Button>
                <Button variant="outline" onClick={() => void copy("link", failedLinks.portalUrl)}>{copied === "link" ? <><Check aria-hidden="true" />Link copied</> : <><Link2 aria-hidden="true" />Copy link</>}</Button>
              </span>
            </span>
          </Notice>
        )}
        {error && !failedLinks && <Notice tone="error">{getApiErrorMessage(error, "Couldn’t do that. Try again.")}</Notice>}

        {!failedLinks && (
        <div className="flex flex-col gap-2">
          {draft && (
            <Button block disabled={busy || offline} loading={send.isPending && send.variables?.channel === "email"} onClick={() => void run("email")}>
              <Mail aria-hidden="true" />Send by email
            </Button>
          )}
          <Button block variant="outline" disabled={busy || offline} loading={(send.isPending && send.variables?.channel === "whatsapp") || (share.isPending && !draft)} onClick={() => void run("whatsapp")}>
            <MessageCircle aria-hidden="true" />Open in WhatsApp
          </Button>
          <Button block variant="outline" disabled={busy || offline} onClick={() => void run("link")}>
            <Link2 aria-hidden="true" />Copy link
          </Button>
        </div>
        )}
        {offline && <p className="text-sm text-muted-foreground">You’re offline. Sending and sharing need a connection.</p>}
        <DialogClose asChild><Button variant="ghost">{failedLinks ? "Done" : "Cancel"}</Button></DialogClose>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { StateBlock } from "@/components/domain/state-block";
import { Card, CardBody, Page, Split } from "@/components/ui/section";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useClient } from "@/lib/hooks/clients";
import { useInvoice, useInvoiceEvents, useInvoicePdf } from "@/lib/hooks/invoices";
import { useBusiness } from "@/lib/hooks/profile";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { isLive } from "@/lib/invoice";
import { issuerToBusiness, toDocInvoice } from "@/lib/invoice-doc";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { ActionBar, type PanelKind } from "./action-bar";
import { ConfirmPanel } from "./confirm-panel";
import { DetailHeader } from "./detail-header";
import { EventsTimeline } from "./events-timeline";
import { MoneySummary } from "./money-summary";
import { PaymentsSection } from "./payments-section";
import { RecordPanel } from "./record-panel";
import { RemindPanel } from "./remind-panel";
import { SendDialog } from "./send-dialog";

/** Saves a Blob as `filename` through a temporary link. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function InvoiceDetailView({ id }: { id: string }) {
  const online = useAppStore((s) => s.online);
  const toast = useApiToast();
  const query = useInvoice(id);
  const invoice = query.data;
  const eventsQuery = useInvoiceEvents(invoice ? id : undefined);
  const clientQuery = useClient(invoice?.clientId);
  const business = useBusiness();
  const pdf = useInvoicePdf();
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const doc = useMemo(() => (invoice ? toDocInvoice(invoice) : undefined), [invoice]);

  if (query.isPending) {
    if (!online) return <Page><StateBlock kind="offline" cta={{ label: "Try again", onClick: () => void query.refetch() }} /></Page>;
    return <PageSkeleton rows={4} />;
  }
  if (query.isError || !invoice || !doc) {
    const retry = { label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() };
    if (getApiErrorStatus(query.error) === 404) {
      return <Page width="narrow"><StateBlock kind="empty" title="Invoice not found" body="It may have been deleted, or the link is out of date. Your other invoices are unaffected." cta={{ label: "Back to invoices", href: "/invoices" }} /></Page>;
    }
    if (!online) return <Page><StateBlock kind="offline" cta={retry} /></Page>;
    if (getApiErrorStatus(query.error) === 429) return <Page><StateBlock kind="error" title="Too many requests" body="Wait a moment and try again." cta={retry} /></Page>;
    return <Page><StateBlock kind="error" body={getApiErrorMessage(query.error)} cta={retry} /></Page>;
  }

  const { status } = invoice;
  const live = isLive(status);
  const offline = !online;
  const client = clientQuery.data ?? { name: invoice.client.name, companyName: "", address: "" };
  const togglePanel = (p: PanelKind) => setPanel((cur) => (cur === p ? null : p));
  const close = () => setPanel(null);

  const download = async () => {
    try {
      saveBlob(await pdf.mutateAsync(invoice.id), `${invoice.number}.pdf`);
    } catch (e) {
      toast.error(e, "Couldn’t download the PDF.");
    }
  };

  return (
    <Page>
      <div className="flex flex-col gap-6 print:hidden">
        <DetailHeader invoice={invoice} onDownload={() => void download()} downloading={pdf.isPending} offline={offline} />
        <OfflineNotice detail="Sending, reminders, recording payments and the PDF download need a connection and are paused." />
        {panel === "record" && live && <RecordPanel invoice={invoice} onClose={close} />}
        {panel === "remind" && live && <RemindPanel invoice={invoice} onClose={close} />}
        {(panel === "writeoff" || panel === "reverse" || panel === "cancel") && <ConfirmPanel key={panel} kind={panel} invoice={invoice} onClose={close} />}
      </div>

      <Split className="gap-6">
        <Card data-print-area className="min-w-0 print:rounded-none print:border-0">
          <InvoiceDocument
            invoice={doc} client={client} business={issuerToBusiness(invoice.issuer, business)} methods={invoice.methods}
            projectName={invoice.project.name} reveal className="rounded-none border-0 print:p-0"
          />
        </Card>
        <aside className="min-w-0 print:hidden @4xl:sticky @4xl:top-6" aria-label="Actions, payments and activity">
          <Card className="@4xl:max-h-[calc(100dvh-3rem)] @4xl:overflow-y-auto">
            <CardBody>
              <ActionBar status={status} offline={offline} panel={panel} onSend={() => setSendOpen(true)} onPanel={togglePanel} />
            </CardBody>
            <PaymentsSection invoice={invoice} canVoid={status !== "void" && status !== "draft"} offline={offline} />
            <EventsTimeline
              invoice={invoice} status={status} events={eventsQuery.data} isLoading={eventsQuery.isPending && eventsQuery.fetchStatus !== "idle"}
              error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()}
            />
            <MoneySummary invoice={invoice} />
          </Card>
        </aside>
      </Split>
      <SendDialog invoice={invoice} open={sendOpen} onOpenChange={setSendOpen} offline={offline} />
    </Page>
  );
}

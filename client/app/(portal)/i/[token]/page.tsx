import type { Metadata } from "next";
import { InvoicePortalView } from "@/components/portal/invoice-view";

export const metadata: Metadata = { title: "Invoice shared with you" };

export default async function PortalInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvoicePortalView token={token} />;
}

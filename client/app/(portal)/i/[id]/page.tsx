import type { Metadata } from "next";
import { InvoicePortalView } from "@/components/portal/invoice-view";

export const metadata: Metadata = { title: "Invoice shared with you" };

export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePortalView id={id} />;
}

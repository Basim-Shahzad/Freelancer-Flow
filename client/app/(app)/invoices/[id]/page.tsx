import type { Metadata } from "next";
import { InvoiceDetailView } from "@/components/invoices/detail/invoice-detail-view";

export const metadata: Metadata = { title: "Invoice · Paylancr" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailView id={id} />;
}

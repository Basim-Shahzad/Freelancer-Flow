import type { Metadata } from "next";
import { InvoiceCreateView } from "@/components/invoices/create/create-view";

export const metadata: Metadata = { title: "Create invoice · Paylancr" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Supports prefill from project pages: /invoices/new?projectId=…&period=… */
export default async function NewInvoicePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return <InvoiceCreateView projectId={first(sp.projectId)} period={first(sp.period)} />;
}

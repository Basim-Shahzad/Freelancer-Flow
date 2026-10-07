import type { Metadata } from "next";
import { ClientDetailView } from "@/components/clients/client-detail-view";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailView id={id} />;
}

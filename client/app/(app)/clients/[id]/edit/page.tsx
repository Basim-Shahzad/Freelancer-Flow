import type { Metadata } from "next";
import { ClientFormView } from "@/components/clients/client-form-view";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientFormView id={id} />;
}

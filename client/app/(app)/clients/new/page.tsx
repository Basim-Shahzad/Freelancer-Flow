import type { Metadata } from "next";
import { ClientFormView } from "@/components/clients/client-form-view";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return <ClientFormView />;
}

import type { Metadata } from "next";
import { PaymentMethodsView } from "@/components/settings/payment-methods-view";

export const metadata: Metadata = { title: "Payment methods · Settings" };

export default function PaymentMethodsSettingsPage() {
  return <PaymentMethodsView />;
}

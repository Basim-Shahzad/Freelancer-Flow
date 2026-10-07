import type { Metadata } from "next";
import { BusinessView } from "@/components/settings/business-view";

export const metadata: Metadata = { title: "Business profile · Settings" };

export default function BusinessSettingsPage() {
  return <BusinessView />;
}

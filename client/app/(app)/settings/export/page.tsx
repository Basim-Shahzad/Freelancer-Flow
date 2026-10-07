import type { Metadata } from "next";
import { ExportView } from "@/components/settings/export-view";

export const metadata: Metadata = { title: "Export my data · Settings" };

export default function ExportSettingsPage() {
  return <ExportView />;
}

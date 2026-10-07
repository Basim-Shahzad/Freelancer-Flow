import type { Metadata } from "next";
import { ActivityView } from "@/components/settings/activity-view";

export const metadata: Metadata = { title: "Activity log · Settings" };

export default function ActivitySettingsPage() {
  return <ActivityView />;
}

import type { Metadata } from "next";
import { MilestonePortalView } from "@/components/portal/milestone-view";

export const metadata: Metadata = { title: "Milestone shared with you" };

export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MilestonePortalView id={id} />;
}

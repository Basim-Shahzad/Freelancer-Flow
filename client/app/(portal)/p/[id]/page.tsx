import type { Metadata } from "next";
import { ProjectPortalView } from "@/components/portal/project-view";

export const metadata: Metadata = { title: "Project shared with you" };

export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectPortalView id={id} />;
}

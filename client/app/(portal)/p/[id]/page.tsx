import type { Metadata } from "next";
import { ProjectPortalView } from "@/components/portal/project-view";

export const metadata: Metadata = { title: "Project shared with you" };

export default async function PortalProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProjectPortalView token={token} />;
}

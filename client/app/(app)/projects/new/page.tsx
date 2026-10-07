import type { Metadata } from "next";
import { ProjectFormView } from "@/components/projects/project-form-view";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  return <ProjectFormView clientId={clientId} />;
}

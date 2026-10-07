import type { Metadata } from "next";
import { ProjectFormView } from "@/components/projects/project-form-view";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectFormView id={id} />;
}

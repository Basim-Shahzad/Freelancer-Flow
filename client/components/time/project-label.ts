import type { Client, Project } from "@/lib/types";

/** "Harbor Labs · Mobile app" (just the project name when its client is not loaded). */
export const projectLabel = (p: Project, clients: Client[]): string => {
  const c = clients.find((x) => x.id === p.clientId);
  return c ? `${c.name} · ${p.name}` : p.name;
};

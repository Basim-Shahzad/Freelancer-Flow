export const timeKeys = {
  all: ["time"] as const,
  running: () => [...timeKeys.all, "running"] as const,
  projects: () => [...timeKeys.all, "project"] as const,
  project: (projectId: string) => [...timeKeys.projects(), projectId] as const,
};

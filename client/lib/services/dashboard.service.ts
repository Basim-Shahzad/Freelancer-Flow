import type { DashboardSummary } from "@/lib/api/dashboard.types";
import { api } from "./api.service";

export const dashboardService = {
  summary: () => api.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
};

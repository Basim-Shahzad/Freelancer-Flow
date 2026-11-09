import type { ActivityListResponse } from "@/lib/api/activity.types";
import { cleanParams } from "@/lib/api/pagination";
import { api } from "./api.service";

export interface ActivityParams { limit?: number; cursor?: string; entity_type?: string; entity_id?: string; from?: string; to?: string }

export const activityService = {
  list: (params: ActivityParams = {}) => api.get<ActivityListResponse>("/activity", { params: cleanParams(params) }).then((r) => r.data),
};

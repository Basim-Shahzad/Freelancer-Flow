/** Wire types for GET /activity (cursor-based, limit max 200). */
export interface ActivityEventResponse {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityListResponse {
  events: ActivityEventResponse[];
  total: number;
  nextCursor?: string | null;
}

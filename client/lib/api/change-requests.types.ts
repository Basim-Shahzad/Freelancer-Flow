/** Wire types for /change-requests, as the API sends them (camelCase, money and hours as decimal strings). */

export type ApiChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface ChangeRequestResponse {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ApiChangeRequestStatus;
  estimatedHours: string | null;
  estimatedAmount: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeRequestListResponse {
  changeRequests: ChangeRequestResponse[];
  total: number;
}

export interface ChangeRequestCreate {
  projectId: string;
  title: string;
  description?: string | null;
  estimatedHours?: string | null;
  estimatedAmount?: string | null;
}

/** Content is editable only while PENDING; `status` records the (final) decision. */
export interface ChangeRequestUpdate {
  title?: string;
  description?: string | null;
  estimatedHours?: string | null;
  estimatedAmount?: string | null;
  status?: ApiChangeRequestStatus;
  decisionNote?: string | null;
}

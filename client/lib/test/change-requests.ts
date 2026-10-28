import type { ChangeRequestResponse } from "@/lib/api/change-requests.types";
import type { ChangeRequest } from "@/lib/types";

export function changeRequestResponseFixture(overrides: Partial<ChangeRequestResponse> = {}): ChangeRequestResponse {
  return {
    id: "cr1", projectId: "p1", title: "Extra page", description: null, status: "PENDING", estimatedHours: null, estimatedAmount: null,
    requestedAt: "2026-10-01T09:00:00Z", decidedAt: null, decisionNote: null,
    createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z", ...overrides,
  };
}

export function changeRequestFixture(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return { id: "cr1", projectId: "p1", title: "Extra page", description: "", status: "pending", requestedAt: "2026-10-01T09:00:00Z", ...overrides };
}

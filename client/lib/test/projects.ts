import type { MilestoneResponse, ProjectResponse, RetainerPeriodResponse } from "@/lib/api/projects.types";
import type { Milestone, Project, ProjectWithSchedule } from "@/lib/types";

/** A `GET /projects/{id}` response (an hourly USD project by default). */
export function projectResponseFixture(overrides: Partial<ProjectResponse> = {}): ProjectResponse {
  return {
    id: "p1", name: "Mobile app", description: null, type: null, status: "ACTIVE", budget: null, billingType: "HOURLY",
    milestonesEnabled: false, retainerAmount: null, retainerInterval: null, retainerStartDate: null, retainerEndDate: null,
    currency: "USD", hourlyRate: "45.00", dueDate: null, totalTimeSpentMinutes: 0, progressPercent: null,
    client: { id: "c1", name: "Harbor Labs" }, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

export function milestoneResponseFixture(overrides: Partial<MilestoneResponse> = {}): MilestoneResponse {
  return {
    id: "m1", projectId: "p1", name: "Design", description: null, status: "PENDING", dueDate: null, approvalRequired: false,
    amount: null, sortOrder: 0, submittedAt: null, approvedBy: null, approvedAt: null,
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

export function periodResponseFixture(overrides: Partial<RetainerPeriodResponse> = {}): RetainerPeriodResponse {
  return { periodStart: "2026-10-01", periodEnd: "2026-10-31", label: "Oct 2026", invoiceId: null, ...overrides };
}

/** A project view model for pure-logic tests. */
export function projectFixture(overrides: Partial<Project> = {}): Project {
  return {
    id: "p", clientId: "c", client: { id: "c", name: "Client" }, name: "P", description: "", billingType: "fixed", currency: "USD",
    status: "active", budget: 360000, milestonesEnabled: false, totalTimeSpentMinutes: 0, progressPercent: null,
    createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", ...overrides,
  };
}

export function milestoneFixture(overrides: Partial<Milestone> = {}): Milestone {
  return { id: "m", projectId: "p", title: "M", description: "", status: "pending", approvalRequired: false, sortOrder: 0, ...overrides };
}

export function scheduledProjectFixture(overrides: Partial<ProjectWithSchedule> = {}): ProjectWithSchedule {
  return { ...projectFixture(), milestones: [], retainerPeriods: [], ...overrides };
}

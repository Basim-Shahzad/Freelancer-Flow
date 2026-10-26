import { toDecimal } from "@/lib/api/money";
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

const testBase = { description: "", milestonesEnabled: false, totalTimeSpentMinutes: 0, progressPercent: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } as const;
const ref = (id: string, name: string) => ({ clientId: id, client: { id, name } });

/**
 * Projects matching the ids that the (still mocked) seed invoices and time point at, for pure-logic tests that
 * join on `projectId`. The app itself gets projects from the API (`useProjects` / `useProjectOptions`).
 */
export const testProjects: Project[] = [
  { ...testBase, ...ref("c-harbor", "Harbor Labs"), id: "p-harbor", name: "Mobile app", billingType: "hourly", currency: "USD", status: "active", hourlyRate: 4500 },
  { ...testBase, ...ref("c-gulberg", "Gulberg Textiles"), id: "p-gulberg", name: "Brand site", billingType: "milestone", currency: "PKR", status: "active", milestonesEnabled: true },
  { ...testBase, ...ref("c-alnoor", "Al Noor Trading"), id: "p-alnoor", name: "Retainer", billingType: "retainer", currency: "USD", status: "active", retainerAmount: 130000, retainerInterval: "monthly" },
  { ...testBase, ...ref("c-dua", "Dua Studio"), id: "p-dua", name: "Logo refresh", billingType: "fixed", currency: "PKR", status: "active", budget: 18000000 },
  { ...testBase, ...ref("c-kareem", "Kareem & Co."), id: "p-kareem", name: "Pitch deck", billingType: "fixed", currency: "USD", status: "completed", budget: 240000 },
];

/** `testProjects` as `GET /projects` items, for mocking the API. */
export const testProjectResponses = (): ProjectResponse[] => testProjects.map((p) => {
  const money = (minor: number | undefined) => (minor === undefined ? null : toDecimal(minor, p.currency));
  return projectResponseFixture({
    id: p.id, name: p.name, status: p.status.toUpperCase() as ProjectResponse["status"], billingType: p.billingType.toUpperCase() as ProjectResponse["billingType"],
    currency: p.currency, budget: money(p.budget), hourlyRate: money(p.hourlyRate), retainerAmount: money(p.retainerAmount),
    retainerInterval: p.retainerInterval ? (p.retainerInterval.toUpperCase() as "MONTHLY" | "QUARTERLY") : null,
    milestonesEnabled: p.milestonesEnabled, client: p.client,
  });
});

export function scheduledProjectFixture(overrides: Partial<ProjectWithSchedule> = {}): ProjectWithSchedule {
  return { ...projectFixture(), milestones: [], retainerPeriods: [], ...overrides };
}

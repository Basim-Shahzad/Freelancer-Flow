/** Wire types for `/projects` and `/milestones` (ProjectResponse / ProjectCreate / MilestoneResponse ... in the OpenAPI schema). */

export type ApiBillingType = "FIXED" | "HOURLY" | "RETAINER" | "MILESTONE";
export type ApiProjectStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
/** The schema lists YEARLY too, but the server rejects it for retainers (422). */
export type ApiRetainerInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type ApiMilestoneStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface ProjectClientRef {
  id: string;
  name: string;
}

/** Money fields are decimal strings ("1250.50"). */
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: ApiProjectStatus;
  budget: string | null;
  billingType: ApiBillingType;
  milestonesEnabled: boolean;
  retainerAmount: string | null;
  retainerInterval: ApiRetainerInterval | null;
  retainerStartDate: string | null;
  retainerEndDate: string | null;
  currency: string | null;
  hourlyRate: string | null;
  dueDate: string | null;
  totalTimeSpentMinutes: number;
  /** 0-100, server-computed; null when there is nothing to base it on. */
  progressPercent: number | null;
  client: ProjectClientRef;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  total: number;
}

export interface ProjectCreate {
  name: string;
  clientId: string;
  description?: string | null;
  type?: string | null;
  status?: ApiProjectStatus;
  budget?: string | null;
  billingType?: ApiBillingType;
  milestonesEnabled?: boolean;
  retainerAmount?: string | null;
  retainerInterval?: ApiRetainerInterval | null;
  retainerStartDate?: string | null;
  retainerEndDate?: string | null;
  currency?: string | null;
  hourlyRate?: string | null;
  dueDate?: string | null;
}

/** PATCH body: every field optional. */
export type ProjectUpdate = Partial<ProjectCreate>;

export interface RetainerPeriodResponse {
  periodStart: string;
  periodEnd: string;
  label: string;
  /** The live invoice billing this period; null when unbilled. */
  invoiceId: string | null;
}

export interface RetainerPeriodListResponse {
  periods: RetainerPeriodResponse[];
}

export interface MilestoneResponse {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: ApiMilestoneStatus;
  dueDate: string | null;
  approvalRequired: boolean;
  amount: string | null;
  sortOrder: number;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneListResponse {
  milestones: MilestoneResponse[];
  total: number;
}

export interface MilestoneCreate {
  name: string;
  projectId: string;
  description?: string | null;
  dueDate?: string | null;
  approvalRequired?: boolean;
  amount?: string | null;
}

export interface MilestoneUpdate {
  name?: string;
  description?: string | null;
  status?: ApiMilestoneStatus;
  dueDate?: string | null;
  approvalRequired?: boolean;
  amount?: string | null;
  sortOrder?: number;
}

export interface MilestoneReorder {
  milestoneIds: string[];
}

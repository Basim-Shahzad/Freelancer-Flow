import type { Client } from "@/features/clients/types";

export const milestoneStatuses = [
   "PENDING",
   "IN_PROGRESS",
   "SUBMITTED",
   "APPROVED",
   "REJECTED",
] as const;

export type MilestoneStatus = typeof milestoneStatuses[number]

export type MilestoneInList = {
   id: string;
   name: string;
   projectId: string;
   description?: string;
   status: MilestoneStatus;
   dueDate: string;
   approvalRequired: boolean;
   approvedBy?: string;
   approvedAt?: string;
   createdAt: string;
   updatedAt: string;
};

export interface MilestoneListResponse {
   milestones: MilestoneInList[];
   total: number;
}

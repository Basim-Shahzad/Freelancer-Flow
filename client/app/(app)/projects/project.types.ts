import type { Client } from "../clients/clients.types";

export type ProjectStatus = "DRAFT" | "IN_PROGRESS" | "IN_REVIEW" | "INVOICED" | "COMPLETED" | "ARCHIVED" | "CANCELLED";

export type ProjectInList = {
   id: string;
   name: string;
   description?: string;
   type: string;
   status: ProjectStatus;
   budget: string;
   budgetType: "HOURLY" | "FIXED";
   dueDate: string;
   client: {
      id: string
      name: string
   }
   createdAt: string;
   updatedAt: string;
};

export interface ProjectListResponse {
   projects: ProjectInList[];
   total: number;
}

export interface Project {
   id: string;
   name: string;
   description?: string;
   type: string;
   status: ProjectStatus;
   budget: string;
   budgetType: "HOURLY" | "FIXED";
   dueDate: string;
   client: Client;
   createdAt: string;
   updatedAt: string;
}

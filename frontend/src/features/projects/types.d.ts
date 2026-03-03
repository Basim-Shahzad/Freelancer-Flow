import type { Client } from "../clients/types.js";

export interface Project {
   id: string;
   client?: Client;
   clientId?: number;
   name: string;
   description?: string;
   status: "active" | "completed" | "archived";
   dueDate: string;
   totalTimeSpent: number;
   hourlyRate?: string | null;
   fixedRate?: number | null;
   created_at: string;
   updated_at: string;
   isHourlyBasis: boolean;
   pricingType: "Hourly" | "Fixed Price";
}

interface ProjectInList {
   id: string;
   name: string;
   dueDate: string;
   status: "active" | "completed" | "archived";
   totalTimeSpent: number;
   hourlyRate?: string | null;
   fixedRate?: number | null;
   clientName?: string;
   isHourlyBasis: boolean;
   pricingType: "Hourly" | "Fixed Price";
   created_at: string;
}

export type nonPaginatedProjectListResponse = {
   count: number;
   projects: {
      id: string;
      name: string;
      createdAt: string;
   }[];
};

export type PaginatedProjectListResponse = {
   count: number;
   next: any;
   previous: any;
   results: {
      projects: ProjectInList[];
   };
};

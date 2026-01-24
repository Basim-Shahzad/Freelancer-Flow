import type { Client } from "../clients/types.js";

export interface Project {
   id: number;
   name: string;
   client?: Client | number;
   description?: string;
   hourly_rate?: string | number;
   due_date: string;
   status?: string;
   time_tracking?: boolean;
   total_time: number;
   total_billed?: number;
   created_at?: string;
   updated_at?: string;
   user?: number;
}

export interface PaginatedResponse<T> {
   items: T[];
   total: number;
}
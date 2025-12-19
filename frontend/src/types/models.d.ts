export interface Client {
   id: number;
   name: string;
   email?: string;
   phone?: string;
   Company?: string;
   notes?: string;
}

export interface Project {
   id: number;
   name: string;
   client: Client;
   due_date: string;
   description?: string;
   hourly_rate?: number;
   price?: number;
   time_tracking?: boolean;
   status?: string;
}

export interface TimeEntry {
  id: number;
  description: string;
  project: Project;
  duration_minutes: number;
  created_at: string;
  start_time: string;
  end_time: string;
}

export interface TimerState {
   active_project_id: number | null;
   description: string;
   status: "idle" | "running" | "paused";
   elapsed_ms: number;
   start_time: number | null;
}
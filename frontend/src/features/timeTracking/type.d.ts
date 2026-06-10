export interface TimeEntry {
   id: number;
   description: string;
   project: Project;
   invoice: Invoice | null;
   is_billable: boolean;
   invoiced: boolean;
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
   is_billable: boolean;
}

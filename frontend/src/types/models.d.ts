export interface User {
   id: number;
   email: string;
   username?: string;
   hourly_rate?: number;
   phone?: number;
}

export interface Client {
   id: number;
   name: string;
   email?: string;
   phone?: string;
   company?: string;
   address?: string;
   tax_id?: string;
   notes?: string;
   created_at?: string;
   updated_at?: string;
   user?: number;
}

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

export interface InvoiceItem {
   id?: number;
   description: string;
   quantity: string | number;
   unit_price: string | number;
   amount: string | number;
   created_at?: string;
}

export interface InvoiceItemWithMeta extends InvoiceItem {
   _timeEntryId?: number;
}

export interface Invoice {
   id?: number;
   client_id?: number;
   project_id?: number;

   // Nested objects returned by backend
   client?: Client | null;
   project?: Project | null;

   // Display fields returned by backend
   client_name?: string;
   project_name?: string;
   items_count?: number; 

   // Invoice items - backend uses "items" not "InvoiceItems"
   items: InvoiceItem[];
   InvoiceItems?: InvoiceItemWithMeta[]; // Keep for backwards compatibility

   // Invoice details
   status: string;
   due_date: string;
   issue_date?: string;
   invoice_number?: string;
   subtotal: string | number;
   tax_rate?: string | number;
   tax_amount: string | number;
   total: string | number;
   notes?: string;
   payment_date?: string | null;
   is_overdue?: boolean;
   created_at?: string;
   updated_at?: string;
}

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

export interface PaginatedResponse<T> {
   items: T[];
   total: number;
}
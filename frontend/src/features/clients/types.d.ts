export interface Client {
   id: string;
   name: string;
   email?: string;
   phone?: string;
   company?: string;
   address?: string;
   taxId?: string;
   notes?: string;
   createdAt: string;
   updatedAt?: string;
}

interface ClientInList {
   id: string;
   name: string;
   createdAt: string;
   email?: string;
   phone?: string;
   projects: {
      id: string;
      name: string;
   }[];
}

export type nonPaginatedClientListResponse = {
   count: number;
   clients: {
      id: string;
      name: string;
      createdAt: string;
   }[];
};

export type PaginatedClientListResponse = {
   count: number;
   next: any;
   previous: any;
   results: {
      clients: ClientInList[];
   };
};

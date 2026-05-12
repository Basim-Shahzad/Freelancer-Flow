export type ClientInList = {
   id: string;
   name: string;
   email: string;
   phone: string;
   createdAt: string;
   projects: { id: string; name: string }[];
};

export interface ClientListResponse {
   count: number;
   next: any;
   previous: any;
   results: {
      clients: ClientInList[];
   };
}

export interface Client {
   id: string;
   name: string;
   email: string;
   phone: string;
   company: string;
   address: string;
   taxId: string;
   notes: string;
   createdAt: string;
   updatedAt: string;
}

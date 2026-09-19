type ProjectInClientList = {
   id: string;
   name: string;
   createdAt: string;
}

export type ClientInList = {
   id: string;
   name: string;
   email: string;
   phone: string;
   company: string;
   taxId: string;
   createdAt: string;
   projects: ProjectInClientList[]
};

export interface ClientListResponse {
   clients: ClientInList[];
   total: number;
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

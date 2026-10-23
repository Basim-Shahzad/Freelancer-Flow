/** Wire types for `/clients` (ClientResponse / ClientInList / ClientCreate / ClientUpdate in the OpenAPI schema). */

export interface ClientProjectRef {
  id: string;
  name: string;
  createdAt: string;
}

/** List item: company is `company` (not `companyName`) and `taxId` is masked to the last digits. */
export interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  company: string | null;
  taxId: string | null;
  createdAt: string;
  projects: ClientProjectRef[];
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  paymentTermsDays: number | null;
  currency: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCreate {
  name: string;
  email: string;
  companyName?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  paymentTermsDays?: number | null;
  currency?: string | null;
}

/** PATCH body: every field optional. */
export type ClientUpdate = Partial<ClientCreate>;

export interface ClientListResponse {
  clients: ClientListItem[];
  total: number;
}

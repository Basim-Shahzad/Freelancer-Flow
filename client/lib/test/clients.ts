import type { ClientListItem } from "@/lib/api/clients.types";
import type { Client } from "@/lib/types";

const base = { phone: "", address: "", taxId: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z" } as const;

/**
 * Clients matching the ids that the (still mocked) seed projects, time and invoices point at, for pure-logic
 * tests that join on `clientId`. The app itself gets clients from the API (`useClients` / `useClientOptions`).
 */
export const testClients: Client[] = [
  { ...base, id: "c-harbor", name: "Jordan Reyes", companyName: "Harbor Labs", email: "jordan@harborlabs.example", whatsapp: "+15125550142", currency: "USD", termsDays: 14 },
  { ...base, id: "c-gulberg", name: "Hamza Qureshi", companyName: "Gulberg Textiles", email: "hamza@gulbergtextiles.example", whatsapp: "+923215550188", currency: "PKR", termsDays: 14 },
  { ...base, id: "c-alnoor", name: "Sara Al Mansoori", companyName: "Al Noor Trading", email: "sara@alnoor.example", whatsapp: "+971505550117", currency: "USD", termsDays: 7 },
  { ...base, id: "c-dua", name: "Dua Fatima", companyName: "Dua Studio", email: "dua@duastudio.example", whatsapp: "+923335550166", currency: "PKR", termsDays: 7 },
  { ...base, id: "c-kareem", name: "Imran Kareem", companyName: "Kareem & Co.", email: "imran@kareem.example", whatsapp: "+971555550129", currency: "USD", termsDays: 14 },
];

/** `testClients` as `GET /clients` items, for mocking the API or seeding the query cache. */
export const testClientItems: ClientListItem[] = testClients.map((c) => ({
  id: c.id, name: c.name, email: c.email, phone: null, whatsappNumber: c.whatsapp, company: c.companyName, taxId: null, createdAt: c.createdAt, projects: [],
}));

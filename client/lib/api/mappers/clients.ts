import type { ClientCreate, ClientListItem, ClientResponse, ClientUpdate } from "@/lib/api/clients.types";
import { CURRENCIES, type Client, type Currency } from "@/lib/types";

/** Used when the API leaves `currency` / `paymentTermsDays` null (taken from the business profile). */
export interface ClientDefaults {
  currency: Currency;
  termsDays: number;
}

export const FALLBACK_CLIENT_DEFAULTS: ClientDefaults = { currency: "USD", termsDays: 14 };

const asCurrency = (c: string | null | undefined, fallback: Currency): Currency => CURRENCIES.find((x) => x === c) ?? fallback;

/** List items name the company `company` and carry the embedded projects; they have no address, notes, terms or currency. */
export function listItemToClient(item: ClientListItem, defaults: ClientDefaults = FALLBACK_CLIENT_DEFAULTS): Client {
  return {
    id: item.id,
    name: item.name,
    companyName: item.company ?? "",
    email: item.email ?? "",
    whatsapp: item.whatsappNumber ?? "",
    phone: item.phone ?? "",
    address: "",
    taxId: item.taxId ?? "",
    currency: defaults.currency,
    termsDays: defaults.termsDays,
    notes: "",
    createdAt: item.createdAt,
    projects: item.projects,
  };
}

/** Detail responses name the company `companyName`. */
export function responseToClient(r: ClientResponse, defaults: ClientDefaults = FALLBACK_CLIENT_DEFAULTS): Client {
  return {
    id: r.id,
    name: r.name,
    companyName: r.companyName ?? "",
    email: r.email ?? "",
    whatsapp: r.whatsappNumber ?? "",
    phone: r.phone ?? "",
    address: r.address ?? "",
    taxId: r.taxId ?? "",
    currency: asCurrency(r.currency, defaults.currency),
    termsDays: r.paymentTermsDays ?? defaults.termsDays,
    notes: r.notes ?? "",
    createdAt: r.createdAt,
  };
}

/** The editable fields, as the form holds them. */
export type ClientInput = Omit<Client, "id" | "createdAt" | "projects">;

const orNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

export function clientToCreate(c: ClientInput): ClientCreate {
  return {
    name: c.name.trim(),
    email: c.email.trim(),
    companyName: orNull(c.companyName),
    phone: orNull(c.phone),
    whatsappNumber: orNull(c.whatsapp),
    address: orNull(c.address),
    taxId: orNull(c.taxId),
    notes: orNull(c.notes),
    paymentTermsDays: c.termsDays,
    currency: c.currency,
  };
}

/** PATCH body with only the fields that differ from `previous` (an emptied field is sent as null to clear it). */
export function clientToUpdate(next: ClientInput, previous: ClientInput): ClientUpdate {
  const full = clientToCreate(next);
  const before = clientToCreate(previous);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(full) as (keyof ClientCreate)[]) {
    if (full[key] !== before[key]) out[key] = full[key];
  }
  return out as ClientUpdate;
}

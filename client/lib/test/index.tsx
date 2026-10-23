import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { ClientListItem, ClientResponse } from "@/lib/api/clients.types";
import type { ProfileResponse } from "@/lib/api/profile.types";
import type { User } from "@/lib/api/types";
import { api, bare } from "@/lib/services/api.service";
import { useAuthStore } from "@/lib/store/auth";

export const testUser: User = {
  id: "u1",
  email: "test@example.com",
  fullName: "Test User",
  role: "freelancer",
  isActive: true,
  isVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
  lastLoginAt: null,
};

/** Fresh QueryClient with retries off so error states resolve immediately. */
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

/** Puts the auth store into a known state. Defaults to a signed-in user with a token. */
export function seedAuth(state: "authenticated" | "unauthenticated" = "authenticated", token = "test-token") {
  if (state === "authenticated") useAuthStore.setState({ accessToken: token, user: testUser, status: "authenticated", signOutReason: null });
  else useAuthStore.setState({ accessToken: null, user: null, status: "unauthenticated", signOutReason: null });
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  auth?: "authenticated" | "unauthenticated";
  queryClient?: QueryClient;
}

/** RTL render wrapped in a fresh QueryClientProvider with the auth store seeded. */
export function renderWithProviders(ui: React.ReactElement, { auth = "authenticated", queryClient = createTestQueryClient(), ...options }: Options = {}) {
  seedAuth(auth);
  const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/**
 * Mocks the shared `api` instance (and the bare refresh client) with axios-mock-adapter.
 * Call `mock.restore()` in afterEach, or use `mock.reset()` between tests.
 */
export function mockApi() {
  const mock = new MockAdapter(api, { onNoMatch: "throwException" });
  const refresh = new MockAdapter(bare, { onNoMatch: "throwException" });
  return {
    mock,
    refresh,
    reset() {
      mock.reset();
      refresh.reset();
    },
    restore() {
      mock.restore();
      refresh.restore();
    },
  };
}

/** A `GET /clients/{id}` response. */
export function clientFixture(overrides: Partial<ClientResponse> = {}): ClientResponse {
  return {
    id: "c1", name: "Jordan Reyes", email: "jordan@harborlabs.example", companyName: "Harbor Labs", phone: null, whatsappNumber: "+15125550142",
    address: "Austin, US", taxId: null, notes: null, paymentTermsDays: 14, currency: "USD", userId: "u1",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

/** One item of `GET /clients` (company is `company`, tax id masked, projects embedded). */
export function clientListItemFixture(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "c1", name: "Jordan Reyes", email: "jordan@harborlabs.example", phone: null, whatsappNumber: "+15125550142", company: "Harbor Labs",
    taxId: null, createdAt: "2026-01-01T00:00:00Z", projects: [], ...overrides,
  };
}

/** A completed `GET /profile` response; pass `{ businessName: null }` for a user who has not onboarded yet. */
export function profileFixture(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: "pr1", hourlyRate: "40.00", type: null, currency: "USD", country: "PK", timezone: "Asia/Karachi",
    businessName: "Malik Studio", businessAddress: "Gulberg III, Lahore", taxRegistrationNumber: "1234567-8", taxLabel: null,
    taxBasis: "accrual", paymentInstructions: null, invoiceNumberFormat: "INV-{seq}", logoUrl: null, defaultPaymentTermsDays: 14,
    defaultTaxes: [], bankBalance: null, bankBalanceUpdatedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

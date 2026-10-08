import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
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
  if (state === "authenticated") useAuthStore.setState({ accessToken: token, user: testUser, status: "authenticated" });
  else useAuthStore.setState({ accessToken: null, user: null, status: "unauthenticated" });
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

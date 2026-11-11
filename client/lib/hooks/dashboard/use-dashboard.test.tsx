import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DashboardSummary } from "@/lib/api/dashboard.types";
import { useActivity } from "@/lib/hooks/activity";
import { createTestQueryClient, mockApi, profileFixture, primeAuth } from "@/lib/test";
import { dashboardKeys } from "./keys";
import { useDashboardSummary } from "./use-dashboard";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  primeAuth("authenticated");
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/projects").reply(200, { projects: [], total: 0 });
});
afterEach(() => m.restore());

const wrap = () => {
  const client = createTestQueryClient();
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
};

const summary: DashboardSummary = {
  cashIn: { thisMonth: [{ currency: "USD", amount: "12.50" }], lastMonth: [], thisMonthStart: "2026-11-01", lastMonthStart: "2026-10-01", timezone: "UTC" },
  outstanding: { byCurrency: [] },
  unbilled: { time: [], milestones: [], retainerPeriods: [] },
  runningTimer: null,
  activeProjects: 1,
};

describe("useDashboardSummary", () => {
  it("loads and maps the summary", async () => {
    m.mock.onGet("/dashboard/summary").reply(200, summary);
    const { result } = renderHook(() => useDashboardSummary(), { wrapper: wrap().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.cashIn.thisMonth).toEqual({ USD: 1250 });
  });

  it("refreshes the token on 401 and retries", async () => {
    m.mock.onGet("/dashboard/summary").replyOnce(401, { detail: "Token expired" }).onGet("/dashboard/summary").reply(200, summary);
    m.refresh.onPost(/refresh/).reply(200, { accessToken: "new", tokenType: "bearer" });
    const { result } = renderHook(() => useDashboardSummary(), { wrapper: wrap().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("surfaces a network error", async () => {
    m.mock.onGet("/dashboard/summary").networkError();
    const { result } = renderHook(() => useDashboardSummary(), { wrapper: wrap().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is marked stale by the dashboard key prefix", async () => {
    m.mock.onGet("/dashboard/summary").reply(200, summary);
    const { client, wrapper } = wrap();
    const { result } = renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await client.invalidateQueries({ queryKey: dashboardKeys.all });
    await waitFor(() => expect(m.mock.history.get.filter((r) => r.url === "/dashboard/summary").length).toBe(2));
  });
});

describe("useActivity", () => {
  it("sends limit and cursor", async () => {
    m.mock.onGet("/activity").reply(200, { events: [], total: 0, nextCursor: null });
    const { result } = renderHook(() => useActivity({ limit: 6, cursor: "abc" }), { wrapper: wrap().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.mock.history.get.find((r) => r.url === "/activity")?.params).toEqual({ limit: 6, cursor: "abc" });
  });
});

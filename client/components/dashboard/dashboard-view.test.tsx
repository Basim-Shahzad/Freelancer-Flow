import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DashboardSummary } from "@/lib/api/dashboard.types";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { projectResponseFixture } from "@/lib/test/projects";
import { DashboardView } from "./dashboard-view";

const none: DashboardSummary = {
  cashIn: { thisMonth: [], lastMonth: [], thisMonthStart: "2026-11-01", lastMonthStart: "2026-10-01", timezone: "UTC" },
  outstanding: { byCurrency: [] },
  unbilled: { time: [], milestones: [], retainerPeriods: [] },
  runningTimer: null,
  activeProjects: 0,
};

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/projects").reply(200, { projects: [], total: 0 });
  m.mock.onGet("/invoices").reply(200, { invoices: [], total: 0 });
  m.mock.onGet("/activity").reply(200, { events: [], total: 0, nextCursor: null });
  m.mock.onGet("/change-requests").reply(200, { changeRequests: [], total: 0 });
  m.mock.onGet("/time-entries/running").reply(200, null);
});
afterEach(() => m.restore());

describe("DashboardView", () => {
  it("shows a skeleton while loading", () => {
    m.mock.onGet("/dashboard/summary").reply(() => new Promise(() => {}));
    const { container } = renderWithProviders(<DashboardView />);
    expect(container.querySelector("[aria-busy], [class*=skeleton], [role=status]")).not.toBeNull();
  });

  it("shows the empty ledger state when there is no data", async () => {
    m.mock.onGet("/dashboard/summary").reply(200, none);
    renderWithProviders(<DashboardView />);
    expect(await screen.findByText("Your ledger starts here")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    m.mock.onGet("/dashboard/summary").replyOnce(500, { detail: "boom" }).onGet("/dashboard/summary").reply(200, none);
    renderWithProviders(<DashboardView />);
    const retry = await screen.findByRole("button", { name: /try again/i });
    retry.click();
    expect(await screen.findByText("Your ledger starts here")).toBeInTheDocument();
  });

  it("renders each currency separately with a running timer", async () => {
    m.mock.onGet("/projects").reply(200, { projects: [projectResponseFixture({ id: "p1", name: "Mobile app" })], total: 1 });
    m.mock.onGet("/dashboard/summary").reply(200, {
      ...none,
      cashIn: { ...none.cashIn, thisMonth: [{ currency: "USD", amount: "100.00" }, { currency: "PKR", amount: "5000.00" }] },
      outstanding: { byCurrency: [
        { currency: "USD", balance: "250.00", count: 1, overdueBalance: "0.00", overdueCount: 0 },
        { currency: "PKR", balance: "9000.00", count: 2, overdueBalance: "1000.00", overdueCount: 1 },
      ] },
      unbilled: { time: [{ projectId: "p1", projectName: "Mobile app", currency: "USD", hours: "2.00", amount: "200.00" }], milestones: [], retainerPeriods: [] },
      runningTimer: { id: "t1", projectId: "p1", projectName: "Mobile app", description: "Build", startTime: new Date().toISOString(), elapsedMinutes: 1 },
      activeProjects: 1,
    } satisfies DashboardSummary);
    renderWithProviders(<DashboardView />);
    expect(await screen.findByText(/Owed to you/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "USD cash in" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "PKR cash in" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /Mobile app/ }).length).toBeGreaterThan(0));
  });

  it("shows the offline notice when offline", async () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/dashboard/summary").reply(200, { ...none, activeProjects: 1 });
    renderWithProviders(<DashboardView />);
    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
  });
});

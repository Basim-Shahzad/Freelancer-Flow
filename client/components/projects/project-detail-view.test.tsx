import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { clientFixture, mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { milestoneResponseFixture, periodResponseFixture, projectResponseFixture } from "@/lib/test/projects";
import { ProjectDetailView } from "./project-detail-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/projects/p1" }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  m.mock.onGet("/clients/c1").reply(200, clientFixture());
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

const milestoneCalls = () => m.mock.history.get.filter((r) => r.url?.includes("/milestones"));

describe("states", () => {
  it("shows a skeleton while loading", () => {
    m.mock.onGet("/projects/p1").reply(() => new Promise(() => {}));
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });

  it("shows not found on 404", async () => {
    m.mock.onGet("/projects/p1").reply(404, { detail: "Project not found" });
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(await screen.findByText("Project not found")).toBeTruthy();
  });

  it("shows an error on 500", async () => {
    m.mock.onGet("/projects/p1").reply(500, { detail: "boom" });
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("shows the offline state before the first load", () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/projects/p1").reply(() => new Promise(() => {}));
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });
});

describe("content", () => {
  it("hides the milestone panel, and never asks for milestones, when they are disabled", async () => {
    m.mock.onGet("/projects/p1").reply(200, projectResponseFixture({ milestonesEnabled: false, progressPercent: null }));
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Mobile app" })).toBeTruthy();
    expect(screen.queryByText("Milestones")).toBeNull();
    expect(milestoneCalls()).toHaveLength(0);
    expect(screen.getByText("Progress appears once there is something to measure")).toBeTruthy();
  });

  it("shows the milestone panel when enabled", async () => {
    m.mock.onGet("/projects/p1").reply(200, projectResponseFixture({ billingType: "MILESTONE", milestonesEnabled: true, hourlyRate: null, progressPercent: 50 }));
    m.mock.onGet("/projects/p1/milestones/").reply(200, { milestones: [milestoneResponseFixture({ name: "Discovery" })], total: 1 });
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(await screen.findByText("Discovery")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows invoiced and not-yet-invoiced retainer periods, without an invoice action", async () => {
    m.mock.onGet("/projects/p1").reply(200, projectResponseFixture({ billingType: "RETAINER", hourlyRate: null, retainerAmount: "1300.00", retainerInterval: "MONTHLY" }));
    m.mock.onGet("/projects/p1/retainer-periods").reply(200, { periods: [
      periodResponseFixture({ invoiceId: "inv1" }),
      periodResponseFixture({ periodStart: "2026-11-01", periodEnd: "2026-11-30", label: "Nov 2026" }),
    ] });
    renderWithProviders(<ProjectDetailView id="p1" />);
    expect(await screen.findByText("Invoiced")).toBeTruthy();
    expect(screen.getByText("Not yet invoiced")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Oct 2026").length).toBeGreaterThan(0));
    expect(screen.queryByRole("link", { name: /Create invoice.*period/ })).toBeNull();
  });
});

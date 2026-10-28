import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceCreateView } from "@/components/invoices/create/create-view";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { invoiceResponseFixture } from "@/lib/test/invoices";
import { paymentMethodResponses } from "@/lib/test/payment-methods";
import { periodResponseFixture, testProjectResponses, testProjects } from "@/lib/test/projects";
import { timeEntryResponseFixture } from "@/lib/test/time-entries";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
  m.mock.onGet("/projects").reply(200, { projects: testProjectResponses(), total: testProjects.length });
  m.mock.onGet("/invoices").reply(200, { invoices: [], total: 0 });
  m.mock.onGet(/\/projects\/[^/]+\/milestones\/$/).reply(200, { milestones: [], total: 0 });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  push.mockClear();
});
afterEach(() => {
  cleanup();
  m.restore();
  act(() => useAppStore.getState().setOnline(true));
});

const entries = () => ({ timeEntries: [timeEntryResponseFixture({ id: "t1", projectId: "p-harbor" }), timeEntryResponseFixture({ id: "t2", projectId: "p-harbor", isInvoiced: true })], total: 2 });
const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const toReview = async () => {
  await screen.findByRole("button", { name: "Continue" });
  await screen.findByRole("group", { name: "Items to invoice" });
  for (let i = 0; i < 3; i++) next();
  expect(screen.getByRole("heading", { name: "Review" })).toBeTruthy();
};

describe("InvoiceCreateView", () => {
  it("shows a loading state first", () => {
    renderWithProviders(<InvoiceCreateView projectId="p-harbor" />);
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("errors when the projects cannot load", async () => {
    m.mock.onGet("/projects").reply(500, { detail: "boom" });
    renderWithProviders(<InvoiceCreateView projectId="p-harbor" />);
    expect(await screen.findByText(/Couldn’t load your projects and invoices/)).toBeTruthy();
  });

  it("empty: a milestone project with nothing approved needs a line before continuing", async () => {
    renderWithProviders(<InvoiceCreateView projectId="p-gulberg" />);
    expect(await screen.findByText(/Nothing approved yet/)).toBeTruthy();
    next();
    expect(screen.getByRole("alert").textContent).toMatch(/at least one item/);
  });

  it("success: preselects ready time, creates a draft with timeEntryIds and opens it", async () => {
    m.mock.onGet("/time-entries/p-harbor").reply(200, entries());
    m.mock.onPost("/invoices").reply(201, invoiceResponseFixture({ id: "new1", invoiceNumber: "INV-0046", displayStatus: "DRAFT", status: "DRAFT" }));
    renderWithProviders(<InvoiceCreateView projectId="p-harbor" />);
    await toReview();
    expect(screen.getByText(/Number is assigned|The number is assigned/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create invoice" })); });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices/new1"));
    const body = JSON.parse(m.mock.history.post[0]!.data as string) as Record<string, unknown>;
    expect(body).toMatchObject({ projectId: "p-harbor", timeEntryIds: ["t1"], items: [], discountRate: "0" });
    expect("paymentMethodIds" in body).toBe(false); // untouched picker: the server uses the defaults
    expect("taxes" in body).toBe(false); // the profile's default taxes
  });

  it("409 on a retainer period shows the server message on the Items step and refetches the periods", async () => {
    m.mock.onGet("/projects/p-alnoor/retainer-periods").reply(200, { periods: [periodResponseFixture({ periodStart: "2026-01-01", periodEnd: "2026-01-31", label: "Jan 2026" })] });
    m.mock.onPost("/invoices").reply(409, { detail: "That retainer period is already invoiced" });
    renderWithProviders(<InvoiceCreateView projectId="p-alnoor" />);
    await screen.findByRole("group", { name: "Items to invoice" });
    for (let i = 0; i < 3; i++) next();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create invoice" })); });
    expect((await screen.findAllByText("That retainer period is already invoiced")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /retainer period/i })).toBeTruthy();
    expect(JSON.parse(m.mock.history.post[0]!.data as string)).toMatchObject({ retainerPeriodStart: "2026-01-01", items: [] });
    await waitFor(() => expect(m.mock.history.get.filter((r) => r.url === "/projects/p-alnoor/retainer-periods").length).toBeGreaterThan(1));
  });

  it("offline: creating is disabled and says why", async () => {
    m.mock.onGet("/time-entries/p-harbor").reply(200, entries());
    renderWithProviders(<InvoiceCreateView projectId="p-harbor" />);
    await toReview();
    act(() => useAppStore.getState().setOnline(false));
    expect(screen.getByText(/can’t create the invoice until you’re back online/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create invoice" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

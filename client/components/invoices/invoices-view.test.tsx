import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicesView } from "@/components/invoices/invoices-view";
import { useAppStore } from "@/lib/store";
import { mockApi, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { invoiceResponseFixture } from "@/lib/test/invoices";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/" }));

let m: ReturnType<typeof mockApi>;
const listCalls = () => m.mock.history.get.filter((r) => r.url === "/invoices");

beforeEach(() => {
  m = mockApi();
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  m.restore();
  act(() => useAppStore.getState().setOnline(true));
});

const reply = (invoices: ReturnType<typeof invoiceResponseFixture>[], total = invoices.length) =>
  m.mock.onGet("/invoices").reply((config) => [200, { invoices: config.params.status === "OVERDUE" ? invoices.filter((i) => i.displayStatus === "OVERDUE") : invoices, total: config.params.status === "OVERDUE" ? invoices.filter((i) => i.displayStatus === "OVERDUE").length : total }]);

describe("InvoicesView", () => {
  it("shows the loading state, then rows, the count line and the filters", async () => {
    reply([
      invoiceResponseFixture({ id: "a", invoiceNumber: "INV-0002", displayStatus: "OVERDUE", isOverdue: true }),
      invoiceResponseFixture({ id: "b", invoiceNumber: "INV-0001", displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00" }),
    ]);
    renderWithProviders(<InvoicesView />);
    expect(screen.getByRole("status", { name: "Loading invoices" })).toBeTruthy();
    expect(await screen.findByText("INV-0002")).toBeTruthy();
    expect(screen.getByText("INV-0001")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("2 invoices · 1 overdue")).toBeTruthy());
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("Partially paid")).toBeTruthy();
    expect(screen.getByText(/Amounts are shown in each invoice’s own currency/)).toBeTruthy();
    expect(screen.getByLabelText("Search invoices")).toBeTruthy();
    expect(screen.getByLabelText("Status")).toBeTruthy();
  });

  it("searches on the server with the typed invoice number", async () => {
    reply([invoiceResponseFixture()]);
    renderWithProviders(<InvoicesView />);
    await screen.findByText("INV-0001");
    fireEvent.change(screen.getByLabelText("Search invoices"), { target: { value: "0007" } });
    await waitFor(() => expect(listCalls().some((r) => r.params.search === "0007")).toBe(true));
  });

  it("shows the empty state when there are no invoices", async () => {
    reply([]);
    renderWithProviders(<InvoicesView />);
    expect(await screen.findByText("No invoices yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create your first invoice" })).toBeTruthy();
  });

  it("shows an error with retry", async () => {
    m.mock.onGet("/invoices").reply(500, { detail: "Database is down" });
    renderWithProviders(<InvoicesView />);
    expect(await screen.findByText("Database is down")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows the offline state while loading offline", () => {
    act(() => useAppStore.getState().setOnline(false));
    m.mock.onGet("/invoices").reply(() => new Promise(() => {}));
    renderWithProviders(<InvoicesView />);
    expect(screen.queryByRole("status", { name: "Loading invoices" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("offers Load more with the total", async () => {
    reply([invoiceResponseFixture()], 25);
    renderWithProviders(<InvoicesView />);
    expect(await screen.findByRole("button", { name: "Load more" })).toBeTruthy();
    expect(screen.getByText("Showing 1 of 25")).toBeTruthy();
  });
});

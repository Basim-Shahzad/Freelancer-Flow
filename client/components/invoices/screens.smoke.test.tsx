import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceCreateView } from "@/components/invoices/create/create-view";
import { InvoiceDetailView } from "@/components/invoices/detail/invoice-detail-view";
import { InvoicesView } from "@/components/invoices/invoices-view";
import { TimeView } from "@/components/time/time-view";
import { useAppStore } from "@/lib/store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  useAppStore.getState().resetDemo();
  push.mockClear();
});
afterEach(cleanup);

describe("screens render with seed data", () => {
  it("invoices list shows counts, rows and filters", () => {
    render(<InvoicesView />);
    expect(screen.getByText("10 invoices · 1 overdue")).toBeTruthy();
    expect(screen.getAllByText("INV-0042").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Overdue" }));
    expect(screen.queryByText("INV-0042")).toBeNull();
    expect(screen.getAllByText("INV-0039").length).toBeGreaterThan(0);
    expect(screen.getByText(/Amounts are shown in each invoice’s own currency/)).toBeTruthy();
  });

  it("time shows the running timer, day groups and week total", () => {
    render(<TimeView />);
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText(/^This week ·/)).toBeTruthy();
    expect(screen.getAllByText(/Push notification spike/).length).toBeGreaterThan(0);
    // invoiced entry is locked, links to its invoice
    expect(screen.getAllByLabelText("Invoiced on INV-0041").length).toBeGreaterThan(0);
  });

  it("time: add an entry via the panel", async () => {
    render(<TimeView />);
    fireEvent.click(screen.getByRole("button", { name: /Add time/ }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Smoke entry" } });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1:30" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save entry" })); });
    expect(useAppStore.getState().time.some((t) => t.description === "Smoke entry" && t.minutes === 90)).toBe(true);
  });

  it("time: shows a conflict panel for a stale unsynced entry and resolves it", async () => {
    useAppStore.setState((s) => ({ time: s.time.map((t) => (t.id === "t-3" ? { ...t, unsynced: true, updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() } : t)) }));
    render(<TimeView />);
    expect(screen.getByText("One entry changed in two places")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Keep this device" })); });
    expect(screen.queryByText("One entry changed in two places")).toBeNull();
    expect(useAppStore.getState().time.find((t) => t.id === "t-3")?.unsynced).toBe(false);
  });

  it("create: needs a line before continuing, then reaches review with the real document", async () => {
    render(<InvoiceCreateView projectId="p-gulberg" />);
    // milestone project with nothing approved
    expect(screen.getByText(/Nothing approved yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toMatch(/at least one item/);
  });

  it("create: hourly project preselects ready time and creates an invoice", async () => {
    render(<InvoiceCreateView projectId="p-harbor" />);
    const before = useAppStore.getState().invoices.length;
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeTruthy();
    expect(screen.getByLabelText("Invoice INV-0046")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create invoice" })); });
    expect(useAppStore.getState().invoices.length).toBe(before + 1);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/invoices\/inv-/));
    expect(useAppStore.getState().time.filter((t) => t.invoiceId && t.projectId === "p-harbor").length).toBeGreaterThan(1);
  });

  it("detail: overdue invoice header, actions and record payment", async () => {
    render(<InvoiceDetailView id="inv-39" />);
    expect(screen.getByRole("heading", { level: 1, name: "INV-0039" })).toBeTruthy();
    expect(screen.getByText(/15 days overdue/)).toBeTruthy();
    expect(screen.queryByText(/pay now/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save payment" })); });
    expect(useAppStore.getState().invoices.find((i) => i.id === "inv-39")?.payments).toHaveLength(1);
  });

  it("detail: not found and offline states", () => {
    render(<InvoiceDetailView id="nope" />);
    expect(screen.getByText("Invoice not found")).toBeTruthy();
    cleanup();
    act(() => useAppStore.getState().setOnline(false));
    render(<InvoiceDetailView id="inv-42" />);
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: "Record payment" }).hasAttribute("disabled")).toBe(true);
    act(() => useAppStore.getState().setOnline(true));
  });
});

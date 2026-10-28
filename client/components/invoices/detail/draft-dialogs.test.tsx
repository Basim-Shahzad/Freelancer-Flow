import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceResponse } from "@/lib/api/invoices.types";
import { InvoiceDetailView } from "@/components/invoices/detail/invoice-detail-view";
import { useAppStore } from "@/lib/store";
import { clientFixture, mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { eventResponseFixture, invoiceResponseFixture } from "@/lib/test/invoices";
import { paymentMethodResponses } from "@/lib/test/payment-methods";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/" }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

let m: ReturnType<typeof mockApi>;

function mount(over: Partial<InvoiceResponse> = {}) {
  m.mock.onGet("/invoices/inv1").reply(200, invoiceResponseFixture({ status: "DRAFT", displayStatus: "DRAFT", sentAt: null, ...over }));
  m.mock.onGet("/invoices/inv1/events").reply(200, { events: [eventResponseFixture()] });
  return renderWithProviders(<InvoiceDetailView id="inv1" />);
}

beforeEach(() => {
  m = mockApi();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients/c1").reply(200, clientFixture());
  m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  push.mockClear();
  toastMock.success.mockClear();
});
afterEach(() => {
  cleanup();
  m.restore();
  vi.unstubAllGlobals();
  act(() => useAppStore.getState().setOnline(true));
});

const toolbar = () => within(screen.getByRole("toolbar", { name: "Invoice actions" }));
const openMore = () => fireEvent.pointerDown(toolbar().getByRole("button", { name: "More" }), { button: 0, ctrlKey: false });

describe("draft actions", () => {
  it("are offered on a draft only", async () => {
    mount({ status: "SENT", displayStatus: "SENT" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(toolbar().queryByRole("button", { name: "Edit draft" })).toBeNull();
    openMore();
    await screen.findByRole("menuitem", { name: "Share invoice" });
    expect(screen.queryByRole("menuitem", { name: "Delete draft" })).toBeNull();
  });

  it("edit sends only the changed fields and refreshes with the server's totals", async () => {
    mount();
    m.mock.onPatch("/invoices/inv1").reply(200, invoiceResponseFixture({ status: "DRAFT", displayStatus: "DRAFT", notes: "Thanks!", discountRate: "10.00", discountAmount: "100.00", total: "900.00", balanceDue: "900.00", updatedAt: "2026-10-02T00:00:00Z" }));
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Edit draft" }));
    expect(await screen.findByText(/can’t be edited on a draft/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Notes/), { target: { value: "Thanks!" } });
    fireEvent.change(screen.getByLabelText("Discount"), { target: { value: "10" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    expect(JSON.parse(m.mock.history.patch[0]!.data as string)).toEqual({ notes: "Thanks!", discountRate: "10" });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Draft updated", expect.anything()));
    expect(await screen.findAllByText(/900\.00/)).toBeTruthy();
  });

  it("edit validates the due date locally and shows a server 409 inline", async () => {
    mount();
    m.mock.onPatch("/invoices/inv1").reply(409, { detail: "Only draft invoices can be edited" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Edit draft" }));
    fireEvent.change(await screen.findByLabelText("Due date"), { target: { value: "2026-09-01" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    expect(await screen.findByText(/due date can’t be before/)).toBeTruthy();
    expect(m.mock.history.patch).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-30" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    expect(await screen.findByText("Only draft invoices can be edited")).toBeTruthy();
  });

  it("delete asks to confirm, deletes the draft and returns to the list", async () => {
    mount();
    m.mock.onDelete("/invoices/inv1").reply(204);
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    openMore();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete draft" }));
    expect(await screen.findByText("Delete draft INV-0001?")).toBeTruthy();
    expect(m.mock.history.delete).toHaveLength(0);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete draft" })); });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices"));
    expect(m.mock.history.delete[0]!.url).toBe("/invoices/inv1");
  });

  it("a failed delete stays on the dialog with the server message", async () => {
    mount();
    m.mock.onDelete("/invoices/inv1").reply(409, { detail: "Only draft invoices can be deleted" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    openMore();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete draft" }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Delete draft" })); });
    expect(await screen.findByText("Only draft invoices can be deleted")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("delete and recreate removes the draft, then opens the create flow for the same project and period", async () => {
    mount({ retainerPeriodStart: "2026-10-01" });
    m.mock.onDelete("/invoices/inv1").reply(204);
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Edit draft" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete the draft and recreate it" }));
    expect(await screen.findByText("Delete INV-0001 and recreate it?")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete and recreate" })); });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices/new?projectId=p1&period=2026-10-01"));
    expect(m.mock.history.delete).toHaveLength(1);
  });
});

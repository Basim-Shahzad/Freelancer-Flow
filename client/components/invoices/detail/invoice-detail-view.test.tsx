import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceResponse } from "@/lib/api/invoices.types";
import { InvoiceDetailView } from "@/components/invoices/detail/invoice-detail-view";
import { useAppStore } from "@/lib/store";
import { clientFixture, mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { eventResponseFixture, invoiceResponseFixture, paymentResponseFixture, sendResponseFixture } from "@/lib/test/invoices";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/" }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

let m: ReturnType<typeof mockApi>;

function mount(over: Partial<InvoiceResponse> = {}, events = [eventResponseFixture()]) {
  m.mock.onGet("/invoices/inv1").reply(200, invoiceResponseFixture(over));
  m.mock.onGet("/invoices/inv1/events").reply(200, { events });
  return renderWithProviders(<InvoiceDetailView id="inv1" />);
}

beforeEach(() => {
  m = mockApi();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients/c1").reply(200, clientFixture());
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});
afterEach(() => {
  cleanup();
  m.restore();
  vi.unstubAllGlobals();
  act(() => useAppStore.getState().setOnline(true));
});

const toolbar = () => within(screen.getByRole("toolbar", { name: "Invoice actions" }));

describe("states", () => {
  it("loading, then the invoice", async () => {
    mount();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: "INV-0001" })).toBeTruthy();
  });

  it("not found (404)", async () => {
    m.mock.onGet("/invoices/inv1").reply(404, { detail: "Invoice not found" });
    renderWithProviders(<InvoiceDetailView id="inv1" />);
    expect(await screen.findByText("Invoice not found")).toBeTruthy();
  });

  it("error with retry", async () => {
    m.mock.onGet("/invoices/inv1").reply(500, { detail: "Database is down" });
    renderWithProviders(<InvoiceDetailView id="inv1" />);
    expect(await screen.findByText("Database is down")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("offline while loading", () => {
    act(() => useAppStore.getState().setOnline(false));
    m.mock.onGet("/invoices/inv1").reply(() => new Promise(() => {}));
    renderWithProviders(<InvoiceDetailView id="inv1" />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("offline with the invoice loaded: actions are disabled", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    act(() => useAppStore.getState().setOnline(false));
    await waitFor(() => expect(toolbar().getByRole("button", { name: "Record payment" }).hasAttribute("disabled")).toBe(true));
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
  });

  it("shows events and the withholding row only when non-zero", async () => {
    mount({ withholdingAmount: "45.00" }, [eventResponseFixture(), eventResponseFixture({ id: "ev2", eventType: "VIEWED", occurredAt: "2026-10-02T09:00:00Z" })]);
    expect(await screen.findByText("Opened by your client")).toBeTruthy();
    expect(screen.getByText("Sent to your client")).toBeTruthy();
    expect(screen.getAllByText(/Withholding/).length).toBeGreaterThan(0);
    cleanup();
    m.mock.reset();
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onGet("/clients/c1").reply(200, clientFixture());
    mount({ withholdingAmount: "0.00" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(screen.queryByText(/Withholding/)).toBeNull();
  });

  it("never shows a Pay now button", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(screen.queryByText(/pay now/i)).toBeNull();
    expect(screen.getByText(/Paylancr does not process payments/)).toBeTruthy();
  });
});

describe("actions per status", () => {
  it("draft: send, no payment actions", async () => {
    mount({ displayStatus: "DRAFT", status: "DRAFT", sentAt: null });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(toolbar().getByRole("button", { name: "Send invoice" })).toBeTruthy();
    expect(toolbar().queryByRole("button", { name: "Record payment" })).toBeNull();
  });

  it.each([["SENT"], ["PARTIALLY_PAID"], ["OVERDUE"]] as const)("%s: record payment and remind", async (displayStatus) => {
    mount({ displayStatus, isOverdue: displayStatus === "OVERDUE" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(toolbar().getByRole("button", { name: "Record payment" })).toBeTruthy();
    expect(toolbar().getByRole("button", { name: "Send a reminder" })).toBeTruthy();
  });

  it.each([["PAID"], ["WRITTEN_OFF"], ["CANCELLED"]] as const)("%s: no payment actions", async (displayStatus) => {
    mount({ displayStatus });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    expect(toolbar().queryByRole("button", { name: "Record payment" })).toBeNull();
    expect(toolbar().queryByRole("button", { name: "Send a reminder" })).toBeNull();
  });
});

describe("record payment", () => {
  it("posts the payment (method pre-selected from the invoice) and refreshes", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    m.mock.onPost("/invoices/inv1/payments").reply(201, invoiceResponseFixture({ displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00", payments: [paymentResponseFixture()] }));
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Record payment" }));
    fireEvent.change(screen.getByLabelText("Amount received"), { target: { value: "400" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save payment" })); });
    await waitFor(() => expect(m.mock.history.post).toHaveLength(1));
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ amount: "400.00", method: "BANK_TRANSFER" });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Payment recorded")));
    expect(await screen.findByText("Payments")).toBeTruthy();
  });

  it("maps a 422 onto the amount field", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    m.mock.onPost("/invoices/inv1/payments").reply(422, { detail: [{ loc: ["body", "amount"], msg: "Payment exceeds the balance", type: "value_error" }] });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Record payment" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save payment" })); });
    expect(await screen.findByText("Payment exceeds the balance")).toBeTruthy();
  });

  it("blocks more than the balance before calling the server", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Record payment" }));
    fireEvent.change(screen.getByLabelText("Amount received"), { target: { value: "5000" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save payment" })); });
    expect(await screen.findByText(/more than the balance/)).toBeTruthy();
    expect(m.mock.history.post).toHaveLength(0);
  });
});

describe("void a payment", () => {
  it("confirms, then voids", async () => {
    mount({ displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00", payments: [paymentResponseFixture()] });
    m.mock.onDelete("/invoices/inv1/payments/pay1").reply(200, invoiceResponseFixture({ displayStatus: "SENT" }));
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(screen.getByRole("button", { name: /Void\s*payment of/ }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Void payment" })); });
    await waitFor(() => expect(m.mock.history.delete).toHaveLength(1));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("voided")));
  });

  it("shows the server's message on a 409", async () => {
    mount({ displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00", payments: [paymentResponseFixture()] });
    m.mock.onDelete("/invoices/inv1/payments/pay1").reply(409, { detail: "This payment can’t be voided" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(screen.getByRole("button", { name: /Void\s*payment of/ }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Void payment" })); });
    expect(await screen.findByText("This payment can’t be voided")).toBeTruthy();
  });
});

describe("remind", () => {
  async function openRemind() {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Send a reminder" }));
  }

  it("sends an email reminder", async () => {
    await openRemind();
    m.mock.onPost("/invoices/inv1/remind").reply(200, sendResponseFixture());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send email" })); });
    await waitFor(() => expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ channel: "email" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Reminder sent", expect.anything()));
  });

  it("opens the server's reminder link on WhatsApp", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await openRemind();
    m.mock.onPost("/invoices/inv1/remind").reply(200, sendResponseFixture({ whatsappUrl: "https://wa.me/1?text=Reminder" }));
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp message" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open WhatsApp with the reminder" })); });
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://wa.me/1?text=Reminder", "_blank", "noopener,noreferrer"));
  });

  it("says 'reminded recently' on 429 and on 409", async () => {
    await openRemind();
    m.mock.onPost("/invoices/inv1/remind").replyOnce(429, { detail: "slow down" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send email" })); });
    expect(await screen.findByText(/reminded this client recently/)).toBeTruthy();
    m.mock.onPost("/invoices/inv1/remind").replyOnce(409, { detail: "Reminder already sent in the last 24 hours" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send email" })); });
    expect(await screen.findByText(/Reminded recently.*Reminder already sent/)).toBeTruthy();
  });
});

describe("write off, reverse and cancel", () => {
  it("write-off needs a reason", async () => {
    mount({ displayStatus: "OVERDUE", isOverdue: true });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    // The panel is opened from the "More" menu in the UI; drive it through the same toggle the menu calls.
    fireEvent.pointerDown(toolbar().getByRole("button", { name: "More" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Write off" }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: /^Write off / })); });
    expect(await screen.findByText("Say why you’re writing this off")).toBeTruthy();
    expect(m.mock.history.post).toHaveLength(0);
    m.mock.onPost("/invoices/inv1/write-off").reply(200, invoiceResponseFixture({ displayStatus: "WRITTEN_OFF" }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Client vanished" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Write off / })); });
    await waitFor(() => expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ reason: "Client vanished" }));
  });

  it("cancel surfaces the server's 409 message", async () => {
    mount({ displayStatus: "SENT" });
    m.mock.onPost("/invoices/inv1/cancel").reply(409, { detail: "Void the payments before cancelling" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.pointerDown(toolbar().getByRole("button", { name: "More" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancel invoice" }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" })); });
    expect(await screen.findByText("Void the payments before cancelling")).toBeTruthy();
  });

  it("reverses a write-off", async () => {
    mount({ displayStatus: "WRITTEN_OFF" });
    m.mock.onPost("/invoices/inv1/reverse-write-off").reply(200, invoiceResponseFixture({ displayStatus: "SENT" }));
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.pointerDown(toolbar().getByRole("button", { name: "More" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reverse write-off" }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Reverse write-off" })); });
    await waitFor(() => expect(m.mock.history.post).toHaveLength(1));
  });
});

describe("send dialog", () => {
  async function openSend() {
    mount({ displayStatus: "DRAFT", status: "DRAFT", sentAt: null });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.click(toolbar().getByRole("button", { name: "Send invoice" }));
    return screen.findByRole("dialog");
  }

  it("sends by email", async () => {
    const dialog = await openSend();
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture());
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Send by email" })); });
    await waitFor(() => expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ channel: "email" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("INV-0001 sent"));
  });

  it("warns when the email could not be delivered, and keeps the links", async () => {
    const dialog = await openSend();
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture({ emailDelivered: false }));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Send by email" })); });
    expect(await screen.findByText(/couldn’t be delivered/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("opens WhatsApp with the server's prepared message", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const dialog = await openSend();
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture({ whatsappUrl: "https://wa.me/1?text=Hello" }));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Open in WhatsApp" })); });
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://wa.me/1?text=Hello", "_blank", "noopener,noreferrer"));
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ channel: "whatsapp" });
  });

  it("copies the client link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const dialog = await openSend();
    m.mock.onPost("/invoices/inv1/send").reply(200, sendResponseFixture());
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Copy link" })); });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://app.example/i/tok"));
  });

  it("shows the server's message when sending is refused (409)", async () => {
    const dialog = await openSend();
    m.mock.onPost("/invoices/inv1/send").reply(409, { detail: "A cancelled invoice cannot be sent" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Send by email" })); });
    expect(await screen.findByText("A cancelled invoice cannot be sent")).toBeTruthy();
  });

  it("an issued invoice only fetches share links (no email, nothing re-sent)", async () => {
    mount({ displayStatus: "SENT" });
    m.mock.onGet("/invoices/inv1/share").reply(200, { portalUrl: "p", pdfUrl: "d", whatsappUrl: "https://wa.me/2" });
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    fireEvent.pointerDown(toolbar().getByRole("button", { name: "More" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share invoice" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Send by email" })).toBeNull();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Open in WhatsApp" })); });
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://wa.me/2", "_blank", "noopener,noreferrer"));
    expect(m.mock.history.post).toHaveLength(0);
  });
});

describe("PDF", () => {
  it("downloads <invoiceNumber>.pdf", async () => {
    mount();
    m.mock.onGet("/invoices/inv1/pdf").reply(200, new Blob(["%PDF"], { type: "application/pdf" }));
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Download PDF" })); });
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(m.mock.history.get.find((r) => r.url === "/invoices/inv1/pdf")?.responseType).toBe("blob");
    click.mockRestore();
  });

  it("toasts when the download fails", async () => {
    mount();
    m.mock.onGet("/invoices/inv1/pdf").reply(500, { detail: "PDF engine down" });
    await screen.findByRole("heading", { level: 1, name: "INV-0001" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Download PDF" })); });
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});

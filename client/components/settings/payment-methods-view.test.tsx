import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { paymentMethodResponseFixture, paymentMethodResponses } from "@/lib/test/payment-methods";
import { PaymentMethodsView } from "./payment-methods-view";

// Radix Select/Dialog use a few DOM APIs jsdom does not have.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: [], total: 0 });
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/payment-methods");
const loaded = async () => {
  m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
  renderWithProviders(<PaymentMethodsView />);
  await screen.findByRole("button", { name: "Edit Payoneer" });
};
/** Row titles in on-screen order, read from the Edit buttons. */
const order = () => screen.getAllByRole("button", { name: /^Edit / }).map((b) => b.getAttribute("aria-label")!.replace(/^Edit /, ""));
const deferred = () => {
  let release!: (status: number, body?: unknown) => void;
  const gate = new Promise<[number, unknown]>((resolve) => { release = (status, body) => resolve([status, body]); });
  return { gate, release };
};

describe("states", () => {
  it("shows a skeleton while loading", () => {
    m.mock.onGet("/payment-methods").reply(() => new Promise(() => {}));
    renderWithProviders(<PaymentMethodsView />);
    expect(screen.getByRole("status", { name: "Loading settings" })).toBeTruthy();
  });

  it("shows the empty state with the add control", async () => {
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: [] });
    renderWithProviders(<PaymentMethodsView />);
    expect(await screen.findByText("No payment methods yet")).toBeTruthy();
    expect(screen.getByLabelText("Add a method")).toBeTruthy();
  });

  it("shows an error with retry, and recovers", async () => {
    m.mock.onGet("/payment-methods").replyOnce(500, { detail: "boom" });
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    renderWithProviders(<PaymentMethodsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Edit Payoneer" })).toBeTruthy();
  });

  it("shows a rate-limit state on 429", async () => {
    m.mock.onGet("/payment-methods").reply(429, { detail: "Too many" });
    renderWithProviders(<PaymentMethodsView />);
    expect(await screen.findByText("Too many requests")).toBeTruthy();
  });

  it("shows the offline state before the first load", () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/payment-methods").reply(() => new Promise(() => {}));
    renderWithProviders(<PaymentMethodsView />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });

  it("lists the methods in order and locks the controls when offline", async () => {
    await loaded();
    expect(order()).toEqual(["Payoneer", "ESFCA wire (USD)", "PKR bank transfer", "Raast", "JazzCash"]);
    expect(screen.getByText("4 on invoices")).toBeTruthy();
    useAppStore.setState({ online: false });
    await waitFor(() => expect(screen.getByRole("button", { name: "Move Raast up" })).toBeDisabled());
    expect(screen.getByText(/can’t be changed until you’re back online/)).toBeTruthy();
  });
});

describe("editing", () => {
  it("saves an edit, sending the full replacement details", async () => {
    await loaded();
    m.mock.onPatch("/payment-methods/pm-pkrbank").reply(200, paymentMethodResponseFixture("PKR_BANK_TRANSFER", { label: "HBL PKR" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit PKR bank transfer" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "HBL PKR" } });
    fireEvent.click(screen.getByRole("button", { name: "Save method" }));
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    const body = JSON.parse(m.mock.history.patch[0]!.data);
    expect(body.label).toBe("HBL PKR");
    expect(body.details).toMatchObject({ accountTitle: "Ayesha Malik", bankName: "HBL", iban: "PK36HABB0000001123456702" });
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
  });

  it("keeps the panel open with inline errors on a 422", async () => {
    await loaded();
    m.mock.onPatch("/payment-methods/pm-pkrbank").reply(422, { detail: [{ loc: ["body"], msg: "Value error, iban: invalid IBAN checksum", type: "value_error" }] });
    fireEvent.click(screen.getByRole("button", { name: "Edit PKR bank transfer" }));
    fireEvent.change(screen.getByLabelText(/^IBAN/), { target: { value: "PK00BAD" } });
    fireEvent.click(screen.getByRole("button", { name: "Save method" }));
    expect(await screen.findByText("Invalid IBAN checksum")).toBeTruthy();
    expect(screen.getByRole("form", { name: "PKR bank transfer details" })).toBeTruthy();
  });

  it("adds a method and shows the 422 for its fields", async () => {
    await loaded();
    m.mock.onPost("/payment-methods").reply(422, { detail: [{ loc: ["body"], msg: "Value error, mobileNumber: not a valid Pakistani mobile number", type: "value_error" }] });
    fireEvent.click(screen.getByLabelText("Add a method"));
    fireEvent.click(await screen.findByRole("option", { name: /Easypaisa/ }));
    fireEvent.change(await screen.findByLabelText(/^Wallet number/), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^Account title/), { target: { value: "Ayesha" } });
    fireEvent.click(screen.getByRole("button", { name: "Add method" }));
    expect(await screen.findByText("Not a valid Pakistani mobile number")).toBeTruthy();
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({
      type: "EASYPAISA", label: "Easypaisa", details: { mobileNumber: "123", accountTitle: "Ayesha" },
    });
  });
});

describe("row actions", () => {
  it("toggles a method off", async () => {
    await loaded();
    m.mock.onPatch("/payment-methods/pm-raast").reply(200, paymentMethodResponseFixture("RAAST", { isActive: false }));
    fireEvent.click(screen.getByRole("switch", { name: "Show Raast on invoices" }));
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ isActive: false });
  });

  it("makes a method the default", async () => {
    await loaded();
    m.mock.onPatch("/payment-methods/pm-esfca").reply(200, paymentMethodResponseFixture("ESFCA_WIRE", { isDefault: true }));
    const row = screen.getByRole("button", { name: "Edit ESFCA wire (USD)" }).closest("[class*='grid']") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Make default" }));
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ isDefault: true });
  });

  it("reorders optimistically, then rolls back when the server refuses", async () => {
    await loaded();
    const d = deferred();
    m.mock.onPut("/payment-methods/order").reply(() => d.gate);
    fireEvent.click(screen.getByRole("button", { name: "Move Raast up" }));
    await waitFor(() => expect(order().slice(2, 4)).toEqual(["Raast", "PKR bank transfer"]));
    expect(JSON.parse(m.mock.history.put[0]!.data).ids).toHaveLength(5);
    d.release(422, { detail: "ids must list every payment method exactly once" });
    await waitFor(() => expect(order().slice(2, 4)).toEqual(["PKR bank transfer", "Raast"]));
  });

  it("deletes through the dialog and refetches", async () => {
    await loaded();
    m.mock.onDelete("/payment-methods/pm-raast").reply(204);
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses().filter((x) => x.id !== "pm-raast") });
    fireEvent.click(screen.getByRole("button", { name: "Edit Raast" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete this method" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete method" }));
    await waitFor(() => expect(order()).not.toContain("Raast"));
    expect(listCalls().length).toBeGreaterThanOrEqual(2);
  });

  it("shows the server's message when a delete fails", async () => {
    await loaded();
    m.mock.onDelete("/payment-methods/pm-raast").reply(404, { detail: "Payment method not found" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Raast" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete this method" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete method" }));
    expect(await screen.findByText("Payment method not found")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

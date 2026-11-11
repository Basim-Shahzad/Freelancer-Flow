import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPortalTokens } from "@/lib/portal/token";
import { portalApi } from "@/lib/services/portal.service";
import { useAppStore } from "@/lib/store";
import { renderWithProviders } from "@/lib/test";
import { exchangeRatesFixture } from "@/lib/test/exchange-rates";
import { portalInvoiceResponseFixture, snapshotFixture } from "@/lib/test/invoices";
import { InvoicePortalView } from "./invoice-view";

let mock: MockAdapter;
beforeEach(() => {
  resetPortalTokens();
  window.history.replaceState(null, "", "/i/i1?token=tok");
  mock = new MockAdapter(portalApi, { onNoMatch: "throwException" });
  URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { mock.restore(); useAppStore.setState({ online: true }); });

const open = (o = {}) => { mock.onGet("/portal/invoice/i1").reply(200, portalInvoiceResponseFixture(o)); return renderWithProviders(<InvoicePortalView id="i1" />); };

describe("InvoicePortalView", () => {
  it("shows loading then the invoice, strips the token and never says Pay now", async () => {
    open({ displayStatus: "SENT", paymentDisclaimer: "Estimates only." });
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect((await screen.findAllByText(/does not process payments/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimates only\./)).toBeInTheDocument();
    expect(screen.queryByText(/pay now/i)).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(mock.history.get[0]!.headers?.Authorization).toBe("Bearer tok");
  });

  it.each([["PAID", /Paid in full/], ["WRITTEN_OFF", /This invoice is closed/]] as const)("renders %s", async (status, text) => {
    open({ displayStatus: status });
    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
  });

  it("renders overdue and partial statuses", async () => {
    open({ displayStatus: "OVERDUE" });
    expect(await screen.findByText(/past its due date/)).toBeInTheDocument();
  });

  it("renders a payLink as a link-out only", async () => {
    open({ displayStatus: "SENT", paymentMethods: [snapshotFixture({ id: "pm2", type: "PAYONEER", label: "Payoneer", details: { paymentRequestUrl: "https://payoneer.com/pay/x" }, payLink: "https://payoneer.com/pay/x" })] });
    const link = await screen.findByRole("link", { name: /payoneer/i });
    expect(link).toHaveAttribute("href", "https://payoneer.com/pay/x");
    expect(screen.queryByText(/pay now/i)).not.toBeInTheDocument();
  });

  it("shows the fx reference line only when rates are embedded", async () => {
    const { unmount } = open({ displayStatus: "SENT", exchangeRates: exchangeRatesFixture() });
    expect((await screen.findAllByText(/ref\. rate/i)).length).toBeGreaterThan(0);
    expect(mock.history.get).toHaveLength(1);
    unmount();
    mock.reset(); resetPortalTokens(); window.history.replaceState(null, "", "/i/i1?token=tok");
    open({ displayStatus: "SENT", exchangeRates: null });
    await screen.findAllByText(/does not process payments/i);
    expect(screen.queryByText(/ref\. rate/i)).not.toBeInTheDocument();
  });

  it("downloads the PDF from the portal endpoint", async () => {
    mock.onGet("/portal/invoice/i1/pdf").reply(200, new Blob(["pdf"]));
    open({ displayStatus: "SENT" });
    fireEvent.click(await screen.findByRole("button", { name: /download pdf/i }));
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/portal/invoice/i1/pdf")).toBe(true));
  });

  it.each([[401, /expired or isn’t valid/], [403, /expired or isn’t valid/], [404, /no longer active/], [429, /Too many requests/]] as const)("handles %s", async (status, text) => {
    mock.onGet("/portal/invoice/i1").reply(status, { detail: "x" });
    renderWithProviders(<InvoicePortalView id="i1" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("handles a network error as offline", async () => {
    mock.onGet("/portal/invoice/i1").networkError();
    renderWithProviders(<InvoicePortalView id="i1" />);
    expect(await screen.findByText("You’re offline")).toBeInTheDocument();
  });

  it("shows the offline notice while offline", async () => {
    open({ displayStatus: "SENT" });
    await screen.findAllByText(/does not process payments/i);
    act(() => useAppStore.setState({ online: false }));
    expect(await screen.findByText(/You’re offline/)).toBeInTheDocument();
  });

  it("treats a missing token as an invalid link without a request", () => {
    resetPortalTokens(); window.history.replaceState(null, "", "/i/i1");
    renderWithProviders(<InvoicePortalView id="i1" />);
    expect(screen.getByText(/expired or isn’t valid/)).toBeInTheDocument();
    expect(mock.history.get).toHaveLength(0);
  });
});

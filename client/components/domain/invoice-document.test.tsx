import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { responseToInvoice } from "@/lib/api/mappers/invoices";
import { issuerToBusiness, toDocInvoice } from "@/lib/invoice-doc";
import { invoiceResponseFixture, snapshotFixture } from "@/lib/test/invoices";
import { seedBusiness } from "@/lib/seed";

afterEach(cleanup);

function renderDoc(over = {}, props: Partial<Parameters<typeof InvoiceDocument>[0]> = {}) {
  const inv = responseToInvoice(invoiceResponseFixture(over));
  return render(
    <InvoiceDocument invoice={toDocInvoice(inv)} client={{ name: "Jordan", companyName: "Harbor Labs", address: "" }} business={issuerToBusiness(inv.issuer, seedBusiness)} methods={inv.methods} projectName="Mobile app" {...props} />,
  );
}

describe("InvoiceDocument (server invoice)", () => {
  it("shows the server's totals, withholding and the API disclaimer, and never 'Pay now'", () => {
    renderDoc({
      subtotal: "1000.00", taxAmount: "170.00", withholdingAmount: "45.00", total: "1125.00", balanceDue: "1125.00",
      taxes: [
        { name: "GST", rate: "17.00", amount: "170.00", isInclusive: false, isCompound: false, isWithholding: false },
        { name: "WHT", rate: "4.50", amount: "45.00", isInclusive: false, isCompound: false, isWithholding: true },
      ],
    });
    expect(screen.getByText("GST (17%)")).toBeTruthy();
    expect(screen.queryByText(/WHT/)).toBeNull();
    expect(screen.getByText(/Withholding \(deducted by your client\)/)).toBeTruthy();
    expect(screen.getByText(/Paylancr does not process payments/)).toBeTruthy();
    expect(screen.queryByText(/pay now/i)).toBeNull();
  });

  it("hides the withholding row when it is zero", () => {
    renderDoc();
    expect(screen.queryByText(/Withholding/)).toBeNull();
  });

  it("renders a Payoneer payLink as a link-out, plus the additional note", () => {
    renderDoc({
      paymentMethods: [snapshotFixture({ type: "PAYONEER", label: "Payoneer", details: { paymentRequestUrl: "https://payoneer.com/pay/x" }, payLink: "https://payoneer.com/pay/x" })],
      paymentInstructions: "Please reference the invoice number.",
    });
    const link = screen.getByRole("link", { name: /Open Payoneer payment page/ });
    expect(link.getAttribute("href")).toBe("https://payoneer.com/pay/x");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Additional note")).toBeTruthy();
    expect(screen.getByText("Please reference the invoice number.")).toBeTruthy();
    expect(screen.queryByText(/pay now/i)).toBeNull();
  });

  it("shows the balance once something has been paid", () => {
    renderDoc({ displayStatus: "PARTIALLY_PAID", amountPaid: "400.00", balanceDue: "600.00" });
    expect(screen.getByText("Received")).toBeTruthy();
    expect(screen.getAllByText("Balance due").length).toBeGreaterThan(0);
  });
});

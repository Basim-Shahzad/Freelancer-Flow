import { InvoiceDocument } from "@/components/domain/invoice-document";
import { seedBusiness, seedClients, seedInvoices, seedMethods } from "@/lib/seed";
import type { Currency } from "@/lib/types";

/**
 * The REAL client invoice view, inside a phone-width scroll frame, using demo seed data.
 * `reveal` shows full payment details as the client sees them.
 */
export function ClientPreview({ neutral, estimateIn }: { neutral?: boolean; estimateIn?: Currency }) {
  const invoice = seedInvoices.find((i) => i.id === "inv-42");
  const client = seedClients.find((c) => c.id === "c-harbor");
  if (!invoice) return null;
  const methods = invoice.paymentMethodIds.flatMap((id) => seedMethods.filter((m) => m.id === id));
  const business = neutral ? { ...seedBusiness, taxId: "", address: "Your studio address, City" } : seedBusiness;
  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Client invoice page, scrollable preview"
        tabIndex={0}
        className="mx-auto h-[640px] w-[min(100%,390px)] overflow-auto rounded-lg border border-rule bg-background p-3"
      >
        <InvoiceDocument invoice={invoice} client={client} business={business} methods={methods} projectName="Mobile app" reveal estimateIn={estimateIn} />
      </div>
      <p className="mx-auto max-w-[390px] text-center t-caption">
        There is no pay button. Your client copies the details and pays you directly from their own bank or app.
      </p>
    </div>
  );
}
